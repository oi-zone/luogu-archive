import { prisma } from "@luogu-discussion-archive/db";

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
