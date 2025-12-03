import {
  and,
  count,
  countDistinct,
  db,
  desc,
  eq,
  inArray,
  lte,
  schema,
  sql,
  sum,
  type InferEnum,
} from "@luogu-discussion-archive/db";

export type UserNameColor =
  | "purple"
  | "red"
  | "orange"
  | "green"
  | "blue"
  | "gray"
  | "cheater";

export interface UserProfile {
  id: string;
  name: string;
  avatarUrl: string;
  nameColor: UserNameColor;
  badge?: string | undefined;
  ccfLevel?: number | undefined;
  xcpcLevel?: number | undefined;
  slogan: string;
  stats: {
    posts: number;
    articles: number;
    interactions: number;
    judgements: number;
    bens: number;
    articleUpvotes: number;
    articleFavorites: number;
  };
  tags: string[];
}

export interface UserSnapshotAppearance {
  id: number;
  name: string;
  color: string;
  badge: string | null;
  ccfLevel: number;
  xcpcLevel: number;
}

export interface UsernameHistoryEntry {
  id: string;
  username: string;
  changedAt: string;
  note?: string | undefined;
  snapshot: UserSnapshotAppearance;
}

export interface RelatedUser {
  id: string;
  name: string;
  avatarUrl: string;
  slogan: string;
  mutualTags: number;
  nameColor: UserNameColor;
  tag?: string | undefined;
  ccfLevel?: number | undefined;
}

export type TimelineEntry =
  | {
      id: string;
      type: "article";
      title: string;
      summary: string;
      href: string;
      reactions: number;
      comments: number;
      createdAt: string;
    }
  | {
      id: string;
      type: "discussion";
      title: string;
      summary: string;
      href: string;
      replies: number;
      participants: number;
      createdAt: string;
    }
  | {
      id: string;
      type: "articleComment";
      articleTitle: string;
      excerpt: string;
      href: string;
      createdAt: string;
    }
  | {
      id: string;
      type: "discussionReply";
      discussionTitle: string;
      excerpt: string;
      href: string;
      createdAt: string;
    }
  | {
      id: string;
      type: "paste";
      title: string;
      description: string;
      href: string;
      visibility: "public" | "team" | "private";
      createdAt: string;
    }
  | {
      id: string;
      type: "judgement";
      reason: string;
      addedPermission: number;
      revokedPermission: number;
      createdAt: string;
    };

export interface UserProfileBundle {
  profile: UserProfile;
  usernameHistory: UsernameHistoryEntry[];
  related: RelatedUser[];
  timeline: TimelineEntry[];
  timelineHasMore: boolean;
  timelineNextCursor: string | null;
}

const USERNAME_HISTORY_LIMIT = 120;
const TIMELINE_PAGE_DEFAULT_LIMIT = 30;
const TIMELINE_PAGE_MAX_LIMIT = 60;
const TIMELINE_FETCH_BUFFER = 20;

export interface UserTimelineCursor {
  timestamp: Date;
  entryId: string;
}

export interface UserTimelinePage {
  entries: TimelineEntry[];
  hasMore: boolean;
  nextCursor: string | null;
}

export async function getUserProfileBundle(
  userId: number,
): Promise<UserProfileBundle | null> {
  if (!Number.isFinite(userId)) {
    return null;
  }

  console.log("Fetching user profile for userId:", userId);

  const user = await db.query.User.findFirst({
    where: eq(schema.User.id, userId),
    with: {
      snapshots: {
        orderBy: desc(schema.UserSnapshot.capturedAt),
        limit: 1,
      },
    },
  });

  const latestSnapshot = user?.snapshots[0];
  if (!user || !latestSnapshot) {
    return null;
  }

  const [stats, snapshotHistory, timelinePage] = await Promise.all([
    getUserStats(userId),
    db.query.UserSnapshot.findMany({
      where: eq(schema.UserSnapshot.userId, userId),
      orderBy: desc(schema.UserSnapshot.capturedAt),
      limit: USERNAME_HISTORY_LIMIT,
    }),
    getUserTimelinePage(userId, {
      limit: TIMELINE_PAGE_DEFAULT_LIMIT,
    }),
  ]);

  const profile: UserProfile = {
    id: userId.toString(),
    name: latestSnapshot.name,
    avatarUrl: getLuoguAvatar(userId),
    nameColor: mapColorEnumToToken(latestSnapshot.color),
    badge: sanitizeBadge(latestSnapshot.badge) ?? undefined,
    ccfLevel: latestSnapshot.ccfLevel || undefined,
    xcpcLevel: latestSnapshot.xcpcLevel || undefined,
    slogan: latestSnapshot.slogan || "这名用户暂未设置签名。",
    stats,
    tags: buildProfileTags(latestSnapshot),
  };

  const usernameHistory: UsernameHistoryEntry[] = snapshotHistory.map(
    (snapshot) => ({
      id: `${String(snapshot.userId)}-${snapshot.capturedAt.getTime().toString()}`,
      username: snapshot.name,
      changedAt: snapshot.capturedAt.toISOString(),
      note: snapshot.slogan.trim() || undefined,
      snapshot: mapSnapshotAppearance(snapshot),
    }),
  );

  return {
    profile,
    usernameHistory,
    related: [],
    timeline: timelinePage?.entries ?? [],
    timelineHasMore: timelinePage?.hasMore ?? false,
    timelineNextCursor: timelinePage?.nextCursor ?? null,
  };
}

export async function getUserTimelinePage(
  userId: number,
  options?: {
    cursor?: UserTimelineCursor | null;
    limit?: number;
  },
): Promise<UserTimelinePage | null> {
  if (!Number.isFinite(userId) || userId <= 0) {
    return null;
  }

  const requestedLimit = options?.limit ?? TIMELINE_PAGE_DEFAULT_LIMIT;
  const clampedLimit = Math.min(
    Math.max(1, requestedLimit),
    TIMELINE_PAGE_MAX_LIMIT,
  );

  const fetchLimit = clampedLimit + TIMELINE_FETCH_BUFFER;
  const beforeDate = options?.cursor?.timestamp ?? null;

  const rawEntries = await getUserTimelineEntries(
    userId,
    fetchLimit,
    beforeDate,
  );

  const cursor = options?.cursor ?? null;
  const filteredEntries = cursor
    ? rawEntries.filter((entry) => isEntryBeforeCursor(entry, cursor))
    : rawEntries;

  const hasMore = filteredEntries.length > clampedLimit;
  const entries = filteredEntries.slice(0, clampedLimit);
  const lastEntry = entries[entries.length - 1];
  const nextCursor =
    hasMore && lastEntry ? encodeUserTimelineCursor(lastEntry) : null;

  return {
    entries,
    hasMore,
    nextCursor,
  };
}

async function getUserStats(userId: number) {
  const [
    [articleStats],
    [postStats],
    [articleReplies],
    [discussionReplies],
    [judgementStats],
  ] = await Promise.all([
    db
      .select({
        total: count(),
        upvotes: sum(schema.Article.upvote),
        favorites: sum(schema.Article.favorCount),
      })
      .from(schema.Article)
      .where(eq(schema.Article.authorId, userId)),
    db
      .select({ total: countDistinct(schema.PostSnapshot.postId) })
      .from(schema.PostSnapshot)
      .where(eq(schema.PostSnapshot.authorId, userId)),
    db
      .select({ total: count() })
      .from(schema.ArticleReply)
      .where(eq(schema.ArticleReply.authorId, userId)),
    db
      .select({ total: count() })
      .from(schema.Reply)
      .where(eq(schema.Reply.authorId, userId)),
    db
      .select({ total: count() })
      .from(schema.Judgement)
      .where(eq(schema.Judgement.userId, userId)),
  ]);

  const interactions =
    (articleReplies?.total ?? 0) + (discussionReplies?.total ?? 0);

  return {
    posts: postStats?.total ?? 0,
    articles: articleStats?.total ?? 0,
    interactions,
    judgements: judgementStats?.total ?? 0,
    bens: 0,
    articleUpvotes: Number(articleStats?.upvotes ?? 0),
    articleFavorites: Number(articleStats?.favorites ?? 0),
  };
}

async function getUserTimelineEntries(
  userId: number,
  limit: number,
  before?: Date | null,
): Promise<TimelineEntry[]> {
  const articleWhere = before
    ? and(eq(schema.Article.authorId, userId), lte(schema.Article.time, before))
    : eq(schema.Article.authorId, userId);

  const articlePromise = db.query.Article.findMany({
    where: articleWhere,
    orderBy: desc(schema.Article.time),
    limit,
    with: {
      snapshots: {
        orderBy: desc(schema.ArticleSnapshot.capturedAt),
        limit: 1,
      },
    },
  });

  const { rows: postIdRows } = await db.execute<{ postId: number }>(
    sql`
      SELECT ps."postId"
      FROM "PostSnapshot" ps
      JOIN "Post" p ON p."id" = ps."postId"
      WHERE ps."authorId" = ${userId}
        ${before ? sql`AND p."time" <= ${before}` : sql``}
      GROUP BY ps."postId"
      ORDER BY MAX(p."time") DESC
      LIMIT ${limit}
    `,
  );
  const postIds = postIdRows.map((row) => row.postId);
  const postWhereBase = postIds.length
    ? inArray(schema.Post.id, postIds)
    : undefined;
  const postWhere = before
    ? postWhereBase
      ? and(postWhereBase, lte(schema.Post.time, before))
      : lte(schema.Post.time, before)
    : postWhereBase;

  const postsPromise = postIds.length
    ? db.query.Post.findMany({
        where: postWhere,
        orderBy: desc(schema.Post.time),
        limit,
        with: {
          snapshots: {
            orderBy: desc(schema.PostSnapshot.capturedAt),
            limit: 1,
          },
        },
      })
    : Promise.resolve([]);

  const articleRepliesPromise = db.query.ArticleReply.findMany({
    where: before
      ? and(
          eq(schema.ArticleReply.authorId, userId),
          lte(schema.ArticleReply.time, before),
        )
      : eq(schema.ArticleReply.authorId, userId),
    orderBy: desc(schema.ArticleReply.time),
    limit,
    with: {
      article: {
        with: {
          snapshots: {
            orderBy: desc(schema.ArticleSnapshot.capturedAt),
            limit: 1,
          },
        },
      },
    },
  });

  const discussionRepliesPromise = db.query.Reply.findMany({
    where: before
      ? and(eq(schema.Reply.authorId, userId), lte(schema.Reply.time, before))
      : eq(schema.Reply.authorId, userId),
    orderBy: desc(schema.Reply.time),
    limit,
    with: {
      post: {
        with: {
          snapshots: {
            orderBy: desc(schema.PostSnapshot.capturedAt),
            limit: 1,
          },
        },
      },
      snapshots: {
        orderBy: desc(schema.ReplySnapshot.capturedAt),
        limit: 1,
      },
    },
  });

  const pastesPromise = db.query.Paste.findMany({
    where: before
      ? and(eq(schema.Paste.userId, userId), lte(schema.Paste.time, before))
      : eq(schema.Paste.userId, userId),
    orderBy: desc(schema.Paste.time),
    limit,
    with: {
      snapshots: {
        orderBy: desc(schema.PasteSnapshot.capturedAt),
        limit: 1,
      },
    },
  });

  const judgementsPromise = db
    .select({
      time: schema.Judgement.time,
      userId: schema.Judgement.userId,
      reason: schema.Judgement.reason,
      addedPermission: schema.Judgement.addedPermission,
      revokedPermission: schema.Judgement.revokedPermission,
    })
    .from(schema.Judgement)
    .where(
      before
        ? and(
            eq(schema.Judgement.userId, userId),
            lte(schema.Judgement.time, before),
          )
        : eq(schema.Judgement.userId, userId),
    )
    .orderBy(desc(schema.Judgement.time))
    .limit(limit);

  const [
    articles,
    posts,
    articleReplies,
    discussionReplies,
    pastes,
    judgements,
  ] = await Promise.all([
    articlePromise,
    postsPromise,
    articleRepliesPromise,
    discussionRepliesPromise,
    pastesPromise,
    judgementsPromise,
  ]);

  const entries: TimelineEntry[] = [];

  for (const article of articles) {
    const snapshot = article.snapshots[0];
    if (!snapshot) continue;
    entries.push(mapArticleToTimeline(article, snapshot));
  }

  for (const post of posts) {
    const snapshot = post.snapshots[0];
    if (!snapshot) continue;
    if (snapshot.authorId !== userId) continue;
    entries.push(mapDiscussionToTimeline(post, snapshot));
  }

  for (const reply of articleReplies) {
    entries.push(mapArticleReplyToTimeline(reply));
  }

  for (const reply of discussionReplies) {
    entries.push(mapDiscussionReplyToTimeline(reply));
  }

  for (const paste of pastes) {
    entries.push(mapPasteToTimeline(paste));
  }

  for (const judgement of judgements) {
    entries.push(mapJudgementToTimeline(judgement));
  }

  return entries.sort(compareTimelineEntriesDesc).slice(0, limit);
}

function mapArticleToTimeline(
  article: typeof schema.Article.$inferInsert,
  snapshot: typeof schema.ArticleSnapshot.$inferInsert,
): TimelineEntry {
  return {
    id: `article-${article.lid}-${article.time.getTime().toString()}`,
    type: "article",
    title: snapshot.title,
    summary: truncateContent(snapshot.content),
    href: `/a/${article.lid}`,
    reactions: article.upvote,
    comments: article.replyCount,
    createdAt: article.time.toISOString(),
  };
}

function mapDiscussionToTimeline(
  post: typeof schema.Post.$inferInsert,
  snapshot: typeof schema.PostSnapshot.$inferInsert,
): TimelineEntry {
  return {
    id: `discussion-${post.id.toString()}-${post.time.getTime().toString()}`,
    type: "discussion",
    title: snapshot.title,
    summary: truncateContent(snapshot.content),
    href: `/d/${post.id.toString()}`,
    replies: post.replyCount,
    participants: Math.max(1, Math.min(post.replyCount, 50)),
    createdAt: post.time.toISOString(),
  };
}

function mapArticleReplyToTimeline(
  reply: typeof schema.ArticleReply.$inferInsert & {
    article: typeof schema.Article.$inferInsert & {
      snapshots: (typeof schema.ArticleSnapshot.$inferInsert)[];
    };
  },
): TimelineEntry {
  const articleTitle = reply.article.snapshots[0]?.title ?? reply.articleId;
  return {
    id: `article-reply-${reply.id.toString()}`,
    type: "articleComment",
    articleTitle,
    excerpt: truncateContent(reply.content),
    href: `/a/${reply.articleId}#reply-${reply.id.toString()}`,
    createdAt: reply.time.toISOString(),
  };
}

function mapDiscussionReplyToTimeline(
  reply: typeof schema.Reply.$inferInsert & {
    snapshots: (typeof schema.ReplySnapshot.$inferInsert)[];
    post: typeof schema.Post.$inferInsert & {
      snapshots: (typeof schema.PostSnapshot.$inferInsert)[];
    };
  },
): TimelineEntry {
  const discussionTitle =
    reply.post.snapshots[0]?.title ?? reply.postId.toString();
  const content = reply.snapshots[0]?.content ?? "";
  return {
    id: `discussion-reply-${reply.id.toString()}`,
    type: "discussionReply",
    discussionTitle,
    excerpt: truncateContent(content),
    href: `/d/${reply.postId.toString()}#reply-${reply.id.toString()}`,
    createdAt: reply.time.toISOString(),
  };
}

function mapPasteToTimeline(
  paste: typeof schema.Paste.$inferInsert & {
    snapshots: (typeof schema.PasteSnapshot.$inferInsert)[];
  },
): TimelineEntry {
  const snapshot = paste.snapshots[0];
  const description = snapshot?.data
    ? truncateContent(snapshot.data, 120)
    : "暂无内容";
  return {
    id: `paste-${paste.id}-${paste.time.getTime().toString()}`,
    type: "paste",
    title: `云剪贴板 ${paste.id}`,
    description,
    href: `/p/${paste.id}`,
    visibility: snapshot?.public ? "public" : "private",
    createdAt: paste.time.toISOString(),
  };
}

function mapJudgementToTimeline(
  judgement: typeof schema.Judgement.$inferInsert,
): TimelineEntry {
  return {
    id: `judgement-${judgement.userId.toString()}-${judgement.time.getTime().toString()}`,
    type: "judgement",
    reason: judgement.reason,
    addedPermission: judgement.addedPermission,
    revokedPermission: judgement.revokedPermission,
    createdAt: judgement.time.toISOString(),
  };
}

function mapSnapshotAppearance(
  snapshot: typeof schema.UserSnapshot.$inferInsert,
): UserSnapshotAppearance {
  return {
    id: snapshot.userId,
    name: snapshot.name,
    color: snapshot.color,
    badge: sanitizeBadge(snapshot.badge),
    ccfLevel: snapshot.ccfLevel,
    xcpcLevel: snapshot.xcpcLevel,
  };
}

function buildProfileTags(snapshot: typeof schema.UserSnapshot.$inferInsert) {
  const tags = new Set<string>();
  if (snapshot.isRoot) tags.add("超级管理员");
  if (snapshot.isAdmin) tags.add("管理员");
  if (snapshot.isBanned) tags.add("已封禁");
  return Array.from(tags);
}

function getLuoguAvatar(userId: number) {
  return `https://cdn.luogu.com.cn/upload/usericon/${userId.toString()}.png`;
}

const mapColorEnumToToken = (
  color: InferEnum<typeof schema.Color>,
): UserNameColor => color.toLowerCase() as UserNameColor;

function sanitizeBadge(badge?: string | null) {
  if (!badge) return null;
  const text = badge.replace(/<[^>]*>/g, "").trim();
  return text || null;
}

function truncateContent(value: string, limit = 160) {
  const normalized = value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "（暂无内容）";
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit).trim()}…`;
}

export function parseUserTimelineCursor(
  cursor: string,
): UserTimelineCursor | null {
  if (!cursor) return null;
  const separatorIndex = cursor.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex === cursor.length - 1) {
    return null;
  }

  const timestampPart = cursor.slice(0, separatorIndex);
  const idPart = cursor.slice(separatorIndex + 1);
  const millis = Number.parseInt(timestampPart, 36);
  if (!Number.isFinite(millis) || millis <= 0) {
    return null;
  }

  return {
    timestamp: new Date(millis),
    entryId: idPart,
  };
}

function encodeUserTimelineCursor(entry: TimelineEntry) {
  const millis = new Date(entry.createdAt).getTime();
  return `${millis.toString(36)}:${entry.id}`;
}

function isEntryBeforeCursor(entry: TimelineEntry, cursor: UserTimelineCursor) {
  const entryTime = new Date(entry.createdAt).getTime();
  const cursorTime = cursor.timestamp.getTime();
  if (entryTime < cursorTime) return true;
  if (entryTime > cursorTime) return false;
  return entry.id.localeCompare(cursor.entryId) > 0;
}

function compareTimelineEntriesDesc(a: TimelineEntry, b: TimelineEntry) {
  const timeDiff =
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  if (timeDiff !== 0) {
    return timeDiff;
  }
  return a.id.localeCompare(b.id);
}
