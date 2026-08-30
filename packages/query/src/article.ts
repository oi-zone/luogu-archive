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
} from "@luogu-discussion-archive/db";

import type { ArticleEntryPreviewDto } from "./dto.js";
import { getLuoguAvatar } from "./user-profile.js";
import {
  publicArticleCondition,
  verifiedArticleReplyCondition,
  verifiedArticleSnapshotCondition,
} from "./visibility.js";

async function isArticlePublic(lid: string) {
  const [article] = await db
    .select({ lid: schema.Article.lid })
    .from(schema.Article)
    .where(and(eq(schema.Article.lid, lid), publicArticleCondition()))
    .limit(1);
  return Boolean(article);
}

export async function getArticleWithSnapshot(lid: string, capturedAt?: Date) {
  const article = await db.query.Article.findFirst({
    where: and(eq(schema.Article.lid, lid), publicArticleCondition()),
    with: {
      snapshots: {
        orderBy: desc(schema.ArticleSnapshot.capturedAt),
        limit: 1,
        where: capturedAt
          ? and(
              eq(schema.ArticleSnapshot.capturedAt, capturedAt),
              verifiedArticleSnapshotCondition(),
            )
          : verifiedArticleSnapshotCondition(),
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

  if (!article?.snapshots[0] || !article.author.snapshots[0]) {
    return null;
  }

  const [replyCountRow] = await db
    .select({ total: count() })
    .from(schema.ArticleReply)
    .where(
      and(
        eq(schema.ArticleReply.articleId, lid),
        verifiedArticleReplyCondition(),
      ),
    );
  const [snapshotCountRow] = await db
    .select({ total: count() })
    .from(schema.ArticleSnapshot)
    .where(
      and(
        eq(schema.ArticleSnapshot.articleId, lid),
        verifiedArticleSnapshotCondition(),
      ),
    );

  const [participantRow] = await db
    .select({ participants: countDistinct(schema.ArticleReply.authorId) })
    .from(schema.ArticleReply)
    .where(
      and(
        eq(schema.ArticleReply.articleId, lid),
        verifiedArticleReplyCondition(),
      ),
    );

  const articleAuthorId = article.authorId;
  const [authorReplyRow] = articleAuthorId
    ? await db
        .select({ total: count() })
        .from(schema.ArticleReply)
        .where(
          and(
            eq(schema.ArticleReply.articleId, lid),
            eq(schema.ArticleReply.authorId, articleAuthorId),
            verifiedArticleReplyCondition(),
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
    .where(and(eq(schema.Article.lid, lid), publicArticleCondition()))
    .limit(1);

  if (!article) return null;

  const [replyCountRow] = await db
    .select({ total: count() })
    .from(schema.ArticleReply)
    .where(
      and(
        eq(schema.ArticleReply.articleId, lid),
        verifiedArticleReplyCondition(),
      ),
    );

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
  if (!(await isArticlePublic(articleId))) return [];

  const orderExpressions =
    orderBy === "time_asc"
      ? [asc(schema.ArticleReply.time), asc(schema.ArticleReply.id)]
      : [desc(schema.ArticleReply.time), desc(schema.ArticleReply.id)];

  let whereClause = and(
    eq(schema.ArticleReply.articleId, articleId),
    verifiedArticleReplyCondition(),
  );

  if (takeAfterComment !== undefined) {
    const [cursorRow] = await db
      .select({
        id: schema.ArticleReply.id,
        time: schema.ArticleReply.time,
      })
      .from(schema.ArticleReply)
      .where(
        and(
          eq(schema.ArticleReply.id, takeAfterComment),
          verifiedArticleReplyCondition(),
        ),
      )
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
  const [parent] = await db
    .select({ articleId: schema.ArticleReply.articleId })
    .from(schema.ArticleReply)
    .where(
      and(
        eq(schema.ArticleReply.id, commentId),
        verifiedArticleReplyCondition(),
      ),
    )
    .limit(1);
  if (!parent || !(await isArticlePublic(parent.articleId))) return null;

  const comment = await db.query.ArticleReply.findFirst({
    where: and(
      eq(schema.ArticleReply.id, commentId),
      verifiedArticleReplyCondition(),
    ),
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
  if (!comment) return null;
  return comment;
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
} | null> {
  if (!(await isArticlePublic(articleId))) return null;

  const snapshots = await db.query.ArticleSnapshot.findMany({
    where: cursorCapturedAt
      ? and(
          eq(schema.ArticleSnapshot.articleId, articleId),
          lt(schema.ArticleSnapshot.capturedAt, cursorCapturedAt),
          verifiedArticleSnapshotCondition(),
        )
      : and(
          eq(schema.ArticleSnapshot.articleId, articleId),
          verifiedArticleSnapshotCondition(),
        ),
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

export async function getArticleEntries(
  ids: string[],
): Promise<ArticleEntryPreviewDto[]> {
  if (ids.length === 0) return [];

  const articles = await db.query.Article.findMany({
    where: and(inArray(schema.Article.lid, ids), publicArticleCondition()),
    with: {
      author: {
        with: {
          snapshots: {
            columns: {
              name: false,
              badge: false,
              color: true,
              ccfLevel: true,
              xcpcLevel: true,
            },
            extras: {
              name: sql<string>`left(${schema.UserSnapshot.name}, 128)`.as(
                "entry_user_name",
              ),
              badge: sql<
                string | null
              >`left(${schema.UserSnapshot.badge}, 128)`.as("entry_user_badge"),
            },
            orderBy: desc(schema.UserSnapshot.capturedAt),
            limit: 1,
          },
        },
      },
      snapshots: {
        where: verifiedArticleSnapshotCondition(),
        columns: {
          content: false,
          title: false,
          adminNote: false,
          exposureState: false,
          verifiedPublicAt: false,
          verifiedSource: false,
        },
        extras: {
          title: sql<string>`left(${schema.ArticleSnapshot.title}, 512)`.as(
            "entry_title",
          ),
          preview: sql<string>`left(${schema.ArticleSnapshot.content}, 512)`.as(
            "entry_preview",
          ),
        },
        orderBy: desc(schema.ArticleSnapshot.capturedAt),
        limit: 1,
        with: { collection: true },
      },
      copra: {
        columns: { summary: false, tags: false },
        extras: {
          summary: sql<
            string | null
          >`left(${schema.ArticleCopra.summary}, 512)`.as("entry_summary"),
        },
      },
    },
    extras: {
      savedReplyCount: db
        .$count(
          schema.ArticleReply,
          eq(
            schema.Article.lid,
            sql`${schema.ArticleReply}.${sql.identifier(schema.ArticleReply.articleId.name)}`,
          ),
        )
        .mapWith(Number)
        .as("saved_reply_count"),
      snapshotCount: db
        .$count(
          schema.ArticleSnapshot,
          eq(
            schema.Article.lid,
            sql`${schema.ArticleSnapshot}.${sql.identifier(
              schema.ArticleSnapshot.articleId.name,
            )}`,
          ),
        )
        .mapWith(Number)
        .as("snapshot_count"),
    },
  });

  return articles.flatMap((article) =>
    article.snapshots.flatMap((snapshot) =>
      article.author.snapshots.map((authorSnapshot) => ({
        lid: article.lid,
        title: snapshot.title,
        time: article.time.getTime() / 1000,
        author: {
          name: authorSnapshot.name,
          badge: authorSnapshot.badge,
          color: authorSnapshot.color,
          ccfLevel: authorSnapshot.ccfLevel,
          xcpcLevel: authorSnapshot.xcpcLevel,
          uid: article.authorId,
          avatar: getLuoguAvatar(article.authorId),
        },
        upvote: article.upvote,
        replyCount: article.replyCount,
        favorCount: article.favorCount,
        category: snapshot.category,
        preview: snapshot.preview,

        savedReplyCount: article.savedReplyCount,
        snapshotCount: article.snapshotCount,
        summary: article.copra[0]?.summary ?? null,
        tags: null,
      })),
    ),
  );
}
