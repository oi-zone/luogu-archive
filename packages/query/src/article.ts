import { prisma } from "@luogu-discussion-archive/db";

import type { BasicUserSnapshot } from "./types.js";

const DEFAULT_ARTICLE_LIMIT = Number.parseInt(
  process.env.NUM_ARTICLES_HOME_PAGE ?? "60",
  10,
);

const DEFAULT_ARTICLE_WINDOW_MS = Number.parseInt(
  process.env.LIMIT_MILLISECONDS_FEATURED_ARTICLE ??
    process.env.LIMIT_MILLISECONDS_HOT_DISCUSSION ??
    "604800000",
  10,
);

const DEFAULT_ARTICLE_UPVOTE_DECAY_MS = Number.parseInt(
  process.env.LIMIT_MILLISECONDS_FEATURED_ARTICLE_UPVOTE_DECAY ??
    DEFAULT_ARTICLE_WINDOW_MS.toString(),
  10,
);

const ARTICLE_SCORE_WEIGHTS = {
  replies: 0.4,
  favorites: 0.4,
  upvotes: 0.2,
} as const;

export interface FeaturedArticleSummary {
  lid: string;
  time: Date;
  updatedAt: Date;
  replyCount: number;
  recentReplyCount: number;
  favorCount: number;
  upvote: number;
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
  upvoteDecayMs = FEATURED_ARTICLE_DEFAULT_UPVOTE_DECAY_MS,
}: {
  limit?: number;
  windowMs?: number;
  upvoteDecayMs?: number;
} = {}): Promise<FeaturedArticleSummary[]> {
  if (limit <= 0 || windowMs <= 0 || upvoteDecayMs <= 0) {
    return [];
  }

  const since = new Date(Date.now() - windowMs);
  const upvoteDecaySeconds = upvoteDecayMs / 1000;

  const scoreRows = await prisma.$queryRaw<
    { lid: string; score: unknown; recentReplyCount: unknown }[]
  >`
    WITH "recent_replies" AS (
      SELECT "articleId", COUNT(*)::integer AS "recentReplyCount"
      FROM "ArticleReply"
      WHERE "time" >= ${since}
      GROUP BY "articleId"
    )
    SELECT
      "Article"."lid" AS "lid",
      COALESCE("recent_replies"."recentReplyCount", 0) AS "recentReplyCount",
      ((COALESCE("recent_replies"."recentReplyCount", 0) * ${ARTICLE_SCORE_WEIGHTS.replies}) +
       ("Article"."favorCount" * ${ARTICLE_SCORE_WEIGHTS.favorites}) +
       ("Article"."upvote" * EXP(-EXTRACT(EPOCH FROM (NOW() - "Article"."updatedAt")) / ${upvoteDecaySeconds}) * ${ARTICLE_SCORE_WEIGHTS.upvotes}))::double precision AS "score"
    FROM "Article"
    LEFT JOIN "recent_replies" ON "recent_replies"."articleId" = "Article"."lid"
    ORDER BY "score" DESC
    LIMIT ${limit}
  `;

  if (scoreRows.length === 0) {
    return [];
  }

  const lids = scoreRows.map((row) => row.lid);
  const articles = await prisma.article.findMany({
    where: { lid: { in: lids } },
    include: {
      snapshots: {
        orderBy: { capturedAt: "desc" },
        take: 1,
        select: {
          title: true,
          capturedAt: true,
          lastSeenAt: true,
        },
      },
      author: {
        select: {
          id: true,
          snapshots: {
            orderBy: { capturedAt: "desc" },
            take: 1,
            select: {
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
  const articlePromise = prisma.article.findUnique({
    where: { lid },
    include: {
      snapshots: {
        ...(capturedAt ? { where: { capturedAt } } : {}),
        orderBy: { capturedAt: "desc" },
        take: 1,
        include: {
          solutionFor: true,
          collection: true,
        },
      },
      author: {
        include: {
          snapshots: {
            orderBy: { capturedAt: "desc" },
            take: 1,
          },
        },
      },
      _count: {
        select: {
          replies: true,
          snapshots: true,
        },
      },
    },
  });

  const article = await articlePromise;

  if (!article) throw new Error("Article not found");

  const articleAuthorId = article.authorId;

  const participantCountPromise = prisma.user.count({
    where: {
      articleReplies: {
        some: { articleId: lid },
      },
    },
  });

  const [replyParticipantCount, authorReplyCount] = await Promise.all([
    participantCountPromise,
    prisma.articleReply.count({
      where: {
        articleId: lid,
        authorId: articleAuthorId,
      },
    }),
  ]);

  return {
    ...article,
    _replyParticipantCount: replyParticipantCount,
    _authorHasReplied: authorReplyCount > 0,
  };
}

export async function getArticleBasicInfo(lid: string) {
  const article = await prisma.article.findUnique({
    where: { lid },
    select: {
      lid: true,
      authorId: true,
      _count: {
        select: {
          replies: true,
        },
      },
    },
  });

  if (!article) throw new Error("Article not found");

  return article;
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
  return prisma.articleReply.findMany({
    where: { articleId },
    orderBy:
      orderBy === "time_asc"
        ? [{ time: "asc" }, { id: "asc" }]
        : [{ time: "desc" }, { id: "desc" }],
    ...(takeAfterComment !== undefined
      ? {
          cursor: { id: takeAfterComment },
          skip: skip + 1,
        }
      : { skip }),
    take,
    include: {
      author: {
        include: {
          snapshots: {
            orderBy: { capturedAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });
}

export async function getArticleComment(commentId: number) {
  return prisma.articleReply.findUnique({
    where: { id: commentId },
    include: {
      author: {
        include: {
          snapshots: {
            orderBy: { capturedAt: "desc" },
            take: 1,
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
  const snapshots = await prisma.articleSnapshot.findMany({
    where: { articleId },
    orderBy: { capturedAt: "desc" },
    ...(cursorCapturedAt
      ? {
          cursor: {
            articleId_capturedAt: {
              articleId,
              capturedAt: cursorCapturedAt,
            },
          },
          skip: 1,
        }
      : {}),
    take: take + 1,
    include: {
      solutionFor: {
        select: {
          pid: true,
          title: true,
        },
      },
      collection: {
        select: {
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
