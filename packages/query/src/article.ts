import {
  and,
  asc,
  count,
  countDistinct,
  db,
  desc,
  eq,
  gt,
  inArray,
  lt,
  or,
  schema,
  sql,
} from "@luogu-discussion-archive/db/drizzle";

import type { BasicUserSnapshot } from "./types.js";

const DEFAULT_ARTICLE_LIMIT = Number.parseInt(
  process.env.NUM_ARTICLES_HOME_PAGE ?? "120",
  10,
);

const DEFAULT_ARTICLE_WINDOW_MS = Number.parseInt(
  process.env.LIMIT_MILLISECONDS_FEATURED_ARTICLE ??
    process.env.LIMIT_MILLISECONDS_HOT_DISCUSSION ??
    "604800000",
  10,
);

const DEFAULT_ARTICLE_UPVOTE_DECAY_MS = Number.parseInt(
  process.env.LIMIT_MILLISECONDS_FEATURED_ARTICLE_UPVOTE_DECAY ?? "2592000000",
  10,
);

const ARTICLE_SCORE_WEIGHTS = {
  replies: 0.9,
  favorites: 0.05,
  upvotes: 0.05,
} as const;

export interface FeaturedArticleSummary {
  lid: string;
  time: Date;
  updatedAt: Date;
  replyCount: number;
  recentReplyCount: number;
  favorCount: number;
  upvote: number;
  category: number;
  score: number;
  snapshot: {
    title: string;
    capturedAt: Date;
    lastSeenAt: Date;
  };
  author: BasicUserSnapshot | null;
}

export const FEATURED_ARTICLE_DEFAULT_LIMIT = DEFAULT_ARTICLE_LIMIT;
export const FEATURED_ARTICLE_DEFAULT_WINDOW_MS = DEFAULT_ARTICLE_WINDOW_MS;
export const FEATURED_ARTICLE_DEFAULT_UPVOTE_DECAY_MS =
  DEFAULT_ARTICLE_UPVOTE_DECAY_MS;
export const ARTICLE_SCORE_WEIGHT = ARTICLE_SCORE_WEIGHTS;

export async function getFeaturedArticles({
  limit = FEATURED_ARTICLE_DEFAULT_LIMIT,
  windowMs = FEATURED_ARTICLE_DEFAULT_WINDOW_MS,
}: {
  limit?: number;
  windowMs?: number;
} = {}): Promise<FeaturedArticleSummary[]> {
  if (limit <= 0 || windowMs <= 0) {
    return [];
  }

  const since = new Date(Date.now() - windowMs);
  const upvoteDecaySeconds = FEATURED_ARTICLE_DEFAULT_UPVOTE_DECAY_MS / 1000;

  const { rows: scoreRows } = await db.execute<{
    lid: string;
    score: unknown;
    recentReplyCount: unknown;
  }>(sql`
    WITH "recent_replies" AS (
      SELECT "articleId", COUNT(*)::integer AS "recentReplyCount"
      FROM "ArticleReply"
      WHERE "time" >= ${since}
      GROUP BY "articleId"
    )
    SELECT
      "Article"."lid" AS "lid",
      COALESCE("recent_replies"."recentReplyCount", 0) AS "recentReplyCount",
      (LN(
        1 + ((COALESCE("recent_replies"."recentReplyCount", 0) * ${ARTICLE_SCORE_WEIGHTS.replies}::double precision)
        + ("Article"."favorCount" * ${ARTICLE_SCORE_WEIGHTS.favorites}::double precision)
        + ("Article"."upvote" * EXP(-EXTRACT(EPOCH FROM (NOW() - "Article"."time")) / ${upvoteDecaySeconds}::double precision) * ${ARTICLE_SCORE_WEIGHTS.upvotes}::double precision))::double precision
      )::double precision * 2.3) AS "score"
    FROM "Article"
    LEFT JOIN "recent_replies" ON "recent_replies"."articleId" = "Article"."lid"
    ORDER BY "score" DESC
    LIMIT ${limit}
  `);

  if (scoreRows.length === 0) {
    return [];
  }

  const lids = scoreRows.map((row) => row.lid);
  const articles = await db.query.Article.findMany({
    where: inArray(schema.Article.lid, lids),
    with: {
      snapshots: {
        orderBy: desc(schema.ArticleSnapshot.capturedAt),
        limit: 1,
        columns: {
          title: true,
          category: true,
          capturedAt: true,
          lastSeenAt: true,
        },
      },
      author: {
        columns: { id: true },
        with: {
          snapshots: {
            orderBy: desc(schema.UserSnapshot.capturedAt),
            limit: 1,
            columns: {
              name: true,
              badge: true,
              color: true,
              ccfLevel: true,
              xcpcLevel: true,
            },
          },
        },
      },
    },
  });

  const articleMap = new Map(articles.map((article) => [article.lid, article]));

  return scoreRows
    .map((row) => {
      const article = articleMap.get(row.lid);
      if (!article) return null;
      const snapshot = article.snapshots[0];
      if (!snapshot) return null;
      const authorSnapshot = article.author.snapshots[0];

      const author: BasicUserSnapshot | null = authorSnapshot
        ? {
            id: article.author.id,
            name: authorSnapshot.name,
            badge: authorSnapshot.badge ?? null,
            color: authorSnapshot.color,
            ccfLevel: authorSnapshot.ccfLevel,
            xcpcLevel: authorSnapshot.xcpcLevel,
          }
        : null;

      const score = Number(row.score);
      const recentReplyCount = Number(row.recentReplyCount ?? 0);

      return {
        lid: article.lid,
        time: article.time,
        updatedAt: article.updatedAt,
        replyCount: article.replyCount,
        recentReplyCount,
        favorCount: article.favorCount,
        upvote: article.upvote,
        category: snapshot.category,
        score,
        snapshot: {
          title: snapshot.title,
          capturedAt: snapshot.capturedAt,
          lastSeenAt: snapshot.lastSeenAt,
        },
        author,
      } satisfies FeaturedArticleSummary;
    })
    .filter((item): item is FeaturedArticleSummary => item !== null);
}

export async function getArticleWithSnapshot(lid: string, capturedAt?: Date) {
  const article = await db.query.Article.findFirst({
    where: eq(schema.Article.lid, lid),
    with: {
      snapshots: {
        orderBy: desc(schema.ArticleSnapshot.capturedAt),
        limit: 1,
        ...(capturedAt
          ? { where: eq(schema.ArticleSnapshot.capturedAt, capturedAt) }
          : {}),
        with: {
          solutionFor: {
            columns: {
              pid: true,
              title: true,
              difficulty: true,
            },
          },
          collection: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      },
      author: {
        with: {
          snapshots: {
            orderBy: desc(schema.UserSnapshot.capturedAt),
            limit: 1,
          },
        },
      },
    },
  });

  if (!article) throw new Error("Article not found");

  const [replyCountRow] = await db
    .select({ total: count() })
    .from(schema.ArticleReply)
    .where(eq(schema.ArticleReply.articleId, lid));
  const [snapshotCountRow] = await db
    .select({ total: count() })
    .from(schema.ArticleSnapshot)
    .where(eq(schema.ArticleSnapshot.articleId, lid));

  const [participantRow] = await db
    .select({ participants: countDistinct(schema.ArticleReply.authorId) })
    .from(schema.ArticleReply)
    .where(eq(schema.ArticleReply.articleId, lid));

  const articleAuthorId = article.authorId;
  const [authorReplyRow] = articleAuthorId
    ? await db
        .select({ total: count() })
        .from(schema.ArticleReply)
        .where(
          and(
            eq(schema.ArticleReply.articleId, lid),
            eq(schema.ArticleReply.authorId, articleAuthorId),
          ),
        )
    : [{ total: 0 }];

  const replyParticipantCount = participantRow?.participants ?? 0;

  return {
    ...article,
    _count: {
      replies: replyCountRow?.total ?? 0,
      snapshots: snapshotCountRow?.total ?? 0,
    },
    _replyParticipantCount: replyParticipantCount,
    _authorHasReplied: (authorReplyRow?.total ?? 0) > 0,
  };
}

export async function getArticleBasicInfo(lid: string) {
  const [article] = await db
    .select({
      lid: schema.Article.lid,
      authorId: schema.Article.authorId,
    })
    .from(schema.Article)
    .where(eq(schema.Article.lid, lid))
    .limit(1);

  if (!article) throw new Error("Article not found");

  const [replyCountRow] = await db
    .select({ total: count() })
    .from(schema.ArticleReply)
    .where(eq(schema.ArticleReply.articleId, lid));

  return {
    ...article,
    _count: {
      replies: replyCountRow?.total ?? 0,
    },
  };
}

export async function getArticleComments(
  articleId: string,
  {
    orderBy = "time_asc",
    takeAfterComment,
    take = 10,
    skip = 0,
  }: {
    orderBy: "time_asc" | "time_desc";
    takeAfterComment?: number;
    take: number;
    skip: number;
  } = {
    orderBy: "time_asc",
    take: 10,
    skip: 0,
  },
) {
  const orderExpressions =
    orderBy === "time_asc"
      ? [asc(schema.ArticleReply.time), asc(schema.ArticleReply.id)]
      : [desc(schema.ArticleReply.time), desc(schema.ArticleReply.id)];

  let whereClause = eq(schema.ArticleReply.articleId, articleId);

  if (takeAfterComment !== undefined) {
    const [cursorRow] = await db
      .select({
        id: schema.ArticleReply.id,
        time: schema.ArticleReply.time,
      })
      .from(schema.ArticleReply)
      .where(eq(schema.ArticleReply.id, takeAfterComment))
      .limit(1);

    if (!cursorRow) {
      return [];
    }

    const comparator =
      orderBy === "time_asc"
        ? or(
            gt(schema.ArticleReply.time, cursorRow.time),
            and(
              eq(schema.ArticleReply.time, cursorRow.time),
              gt(schema.ArticleReply.id, cursorRow.id),
            ),
          )
        : or(
            lt(schema.ArticleReply.time, cursorRow.time),
            and(
              eq(schema.ArticleReply.time, cursorRow.time),
              lt(schema.ArticleReply.id, cursorRow.id),
            ),
          );

    const combined = and(whereClause, comparator);
    if (!combined) {
      return [];
    }

    whereClause = combined;
  }

  return db.query.ArticleReply.findMany({
    where: whereClause,
    orderBy: orderExpressions,
    offset: skip,
    limit: take,
    with: {
      author: {
        with: {
          snapshots: {
            orderBy: desc(schema.UserSnapshot.capturedAt),
            limit: 1,
          },
        },
      },
    },
  });
}

export async function getArticleComment(commentId: number) {
  return db.query.ArticleReply.findFirst({
    where: eq(schema.ArticleReply.id, commentId),
    with: {
      author: {
        with: {
          snapshots: {
            orderBy: desc(schema.UserSnapshot.capturedAt),
            limit: 1,
          },
        },
      },
    },
  });
}

type ArticleSnapshotChangedField =
  | "title"
  | "content"
  | "category"
  | "status"
  | "solution"
  | "collection"
  | "promoteStatus"
  | "adminNote";

interface ArticleSnapshotTimelineResult {
  capturedAt: Date;
  lastSeenAt: Date;
  title: string;
  category: number;
  status: number;
  solutionFor: {
    pid: string;
    title: string;
  } | null;
  collection: {
    id: number;
    name: string;
  } | null;
  promoteStatus: number;
  adminNote: string | null;
  changedFields: ArticleSnapshotChangedField[];
  hasPrevious: boolean;
}

export async function getArticleSnapshotsTimeline(
  articleId: string,
  {
    cursorCapturedAt,
    take = 10,
  }: {
    cursorCapturedAt?: Date;
    take?: number;
  } = {},
): Promise<{
  items: ArticleSnapshotTimelineResult[];
  hasMore: boolean;
  nextCursor: Date | null;
}> {
  const snapshots = await db.query.ArticleSnapshot.findMany({
    where: cursorCapturedAt
      ? and(
          eq(schema.ArticleSnapshot.articleId, articleId),
          lt(schema.ArticleSnapshot.capturedAt, cursorCapturedAt),
        )
      : eq(schema.ArticleSnapshot.articleId, articleId),
    orderBy: desc(schema.ArticleSnapshot.capturedAt),
    limit: take + 1,
    with: {
      solutionFor: {
        columns: {
          pid: true,
          title: true,
        },
      },
      collection: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (snapshots.length === 0) {
    return {
      items: [],
      hasMore: false,
      nextCursor: null,
    };
  }

  const hasMore = snapshots.length > take;
  const trimmed = hasMore ? snapshots.slice(0, take) : snapshots;

  const items: ArticleSnapshotTimelineResult[] = trimmed.map(
    (snapshot, index) => {
      const previous = snapshots[index + 1];
      const changedFields: ArticleSnapshotChangedField[] = [];

      if (previous) {
        if (snapshot.title !== previous.title) {
          changedFields.push("title");
        }

        if (snapshot.content !== previous.content) {
          changedFields.push("content");
        }

        if (snapshot.category !== previous.category) {
          changedFields.push("category");
        }

        if (snapshot.status !== previous.status) {
          changedFields.push("status");
        }

        if (snapshot.solutionForPid !== previous.solutionForPid) {
          changedFields.push("solution");
        }

        if (snapshot.collectionId !== previous.collectionId) {
          changedFields.push("collection");
        }

        if (snapshot.promoteStatus !== previous.promoteStatus) {
          changedFields.push("promoteStatus");
        }

        if ((snapshot.adminNote ?? "") !== (previous.adminNote ?? "")) {
          changedFields.push("adminNote");
        }
      }

      return {
        capturedAt: snapshot.capturedAt,
        lastSeenAt: snapshot.lastSeenAt,
        title: snapshot.title,
        category: snapshot.category,
        status: snapshot.status,
        solutionFor: snapshot.solutionFor
          ? {
              pid: snapshot.solutionFor.pid,
              title: snapshot.solutionFor.title,
            }
          : null,
        collection: snapshot.collection
          ? {
              id: snapshot.collection.id,
              name: snapshot.collection.name,
            }
          : null,
        promoteStatus: snapshot.promoteStatus,
        adminNote: snapshot.adminNote ?? null,
        changedFields,
        hasPrevious: Boolean(previous),
      };
    },
  );

  const lastItem = trimmed.length > 0 ? trimmed[trimmed.length - 1] : undefined;

  return {
    items,
    hasMore,
    nextCursor: hasMore && lastItem ? lastItem.capturedAt : null,
  };
}
