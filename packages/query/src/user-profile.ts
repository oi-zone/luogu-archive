import {
  Color,
  prisma,
  type Article,
  type ArticleReply,
  type ArticleSnapshot,
  type Judgement,
  type Paste,
  type PasteSnapshot,
  type Post,
  type PostSnapshot,
  type Reply,
  type ReplySnapshot,
  type UserSnapshot,
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
  highlightTag?: string | undefined;
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
  joinDate: string;
  location: string;
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
      action: string;
      reason: string;
      createdAt: string;
    };

export interface UserProfileBundle {
  profile: UserProfile;
  usernameHistory: UsernameHistoryEntry[];
  related: RelatedUser[];
  timeline: TimelineEntry[];
}

const USERNAME_HISTORY_LIMIT = 120;
const TIMELINE_FETCH_LIMIT = 30;

export async function getUserProfileBundle(
  userId: number,
): Promise<UserProfileBundle | null> {
  if (!Number.isFinite(userId)) {
    return null;
  }

  console.log("Fetching user profile for userId:", userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      snapshots: {
        orderBy: { capturedAt: "desc" },
        take: 1,
      },
    },
  });

  const latestSnapshot = user?.snapshots[0];
  if (!user || !latestSnapshot) {
    return null;
  }

  const [stats, joinRecord, snapshotHistory, timeline] = await Promise.all([
    getUserStats(userId),
    prisma.userSnapshot.findFirst({
      where: { userId },
      orderBy: { capturedAt: "asc" },
      select: { capturedAt: true },
    }),
    prisma.userSnapshot.findMany({
      where: { userId },
      orderBy: { capturedAt: "desc" },
      take: USERNAME_HISTORY_LIMIT,
    }),
    getUserTimelineEntries(userId, TIMELINE_FETCH_LIMIT),
  ]);

  const profile: UserProfile = {
    id: userId.toString(),
    name: latestSnapshot.name,
    avatarUrl: getLuoguAvatar(userId),
    nameColor: mapColorEnumToToken(latestSnapshot.color),
    highlightTag: sanitizeBadge(latestSnapshot.badge) ?? undefined,
    ccfLevel: latestSnapshot.ccfLevel || undefined,
    xcpcLevel: latestSnapshot.xcpcLevel || undefined,
    slogan: latestSnapshot.slogan || "这名用户暂未设置签名。",
    stats,
    joinDate: (
      joinRecord?.capturedAt ?? latestSnapshot.capturedAt
    ).toISOString(),
    location: latestSnapshot.isBanned ? "账号受限" : "洛谷社区",
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
    timeline,
  };
}

async function getUserStats(userId: number) {
  const [
    articleAggregate,
    postCount,
    [articleComments, discussionReplies],
    judgementCount,
  ] = await Promise.all([
    prisma.article.aggregate({
      where: { authorId: userId },
      _count: { _all: true },
      _sum: { upvote: true, favorCount: true },
    }),
    prisma.post.count({ where: { snapshots: { some: { authorId: userId } } } }),
    Promise.all([
      prisma.articleReply.count({ where: { authorId: userId } }),
      prisma.reply.count({ where: { authorId: userId } }),
    ]),
    prisma.judgement.count({ where: { userId } }),
  ]);

  const interactions = articleComments + discussionReplies;

  return {
    posts: postCount,
    articles: articleAggregate._count._all,
    interactions,
    judgements: judgementCount,
    bens: 0,
    articleUpvotes: articleAggregate._sum.upvote ?? 0,
    articleFavorites: articleAggregate._sum.favorCount ?? 0,
  };
}

async function getUserTimelineEntries(
  userId: number,
  limit: number,
): Promise<TimelineEntry[]> {
  const [
    articles,
    posts,
    articleReplies,
    discussionReplies,
    pastes,
    judgements,
  ] = await Promise.all([
    prisma.article.findMany({
      where: { authorId: userId },
      orderBy: { time: "desc" },
      take: limit,
      include: {
        snapshots: {
          orderBy: { capturedAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.post.findMany({
      where: { snapshots: { some: { authorId: userId } } },
      orderBy: { time: "desc" },
      take: limit,
      include: {
        snapshots: {
          orderBy: { capturedAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.articleReply.findMany({
      where: { authorId: userId },
      orderBy: { time: "desc" },
      take: limit,
      include: {
        article: {
          include: {
            snapshots: {
              orderBy: { capturedAt: "desc" },
              take: 1,
            },
          },
        },
      },
    }),
    prisma.reply.findMany({
      where: { authorId: userId },
      orderBy: { time: "desc" },
      take: limit,
      include: {
        post: {
          include: {
            snapshots: {
              orderBy: { capturedAt: "desc" },
              take: 1,
            },
          },
        },
        snapshots: {
          orderBy: { capturedAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.paste.findMany({
      where: { userId },
      orderBy: { time: "desc" },
      take: limit,
      include: {
        snapshots: {
          orderBy: { capturedAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.judgement.findMany({
      where: { userId },
      orderBy: { time: "desc" },
      take: limit,
    }),
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

  return entries
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, limit);
}

function mapArticleToTimeline(
  article: Article,
  snapshot: ArticleSnapshot,
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
  post: Post,
  snapshot: PostSnapshot,
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
  reply: ArticleReply & { article: Article & { snapshots: ArticleSnapshot[] } },
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
  reply: Reply & {
    snapshots: ReplySnapshot[];
    post: Post & { snapshots: PostSnapshot[] };
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
  paste: Paste & { snapshots: PasteSnapshot[] },
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

function mapJudgementToTimeline(judgement: Judgement): TimelineEntry {
  const changes: string[] = [];
  if (judgement.addedPermission) {
    changes.push(`增加权限 ${judgement.addedPermission.toString()}`);
  }
  if (judgement.revokedPermission) {
    changes.push(`撤销权限 ${judgement.revokedPermission.toString()}`);
  }

  return {
    id: `judgement-${judgement.userId.toString()}-${judgement.time.getTime().toString()}`,
    type: "judgement",
    action: changes.join("，") || "社区裁决",
    reason: judgement.reason,
    createdAt: judgement.time.toISOString(),
  };
}

function mapSnapshotAppearance(snapshot: UserSnapshot): UserSnapshotAppearance {
  return {
    id: snapshot.userId,
    name: snapshot.name,
    color: mapColorEnumToToken(snapshot.color),
    badge: sanitizeBadge(snapshot.badge),
    ccfLevel: snapshot.ccfLevel,
    xcpcLevel: snapshot.xcpcLevel,
  };
}

function buildProfileTags(snapshot: UserSnapshot) {
  const tags = new Set<string>();
  if (snapshot.isAdmin) tags.add("社区管理员");
  if (snapshot.isRoot) tags.add("核心团队");
  if (snapshot.isBanned) tags.add("已封禁");
  if (snapshot.badge) {
    const sanitized = sanitizeBadge(snapshot.badge);
    if (sanitized) tags.add(sanitized);
  }
  return Array.from(tags);
}

function getLuoguAvatar(userId: number) {
  return `https://cdn.luogu.com.cn/upload/usericon/${userId.toString()}.png`;
}

function mapColorEnumToToken(color: Color): UserNameColor {
  const mapping: Record<Color, UserNameColor> = {
    [Color.Purple]: "purple",
    [Color.Red]: "red",
    [Color.Orange]: "orange",
    [Color.Green]: "green",
    [Color.Blue]: "blue",
    [Color.Gray]: "gray",
    [Color.Cheater]: "cheater",
  };
  return mapping[color];
}

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
