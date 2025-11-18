import { prisma } from "@luogu-discussion-archive/db";

export async function getPostWithSnapshot(id: number, capturedAt?: Date) {
  const postPromise = prisma.post.findUnique({
    where: { id },
    include: {
      snapshots: {
        ...(capturedAt ? { where: { capturedAt } } : {}),
        orderBy: { capturedAt: "desc" },
        take: 1,
        include: {
          author: {
            include: {
              snapshots: {
                orderBy: { capturedAt: "desc" },
                take: 1,
              },
            },
          },
          forum: true,
        },
      },
      takedown: true,
      _count: {
        select: {
          replies: true,
          snapshots: true,
        },
      },
    },
  });

  const participantCountPromise = prisma.user.count({
    where: {
      replies: {
        some: { postId: id },
      },
    },
  });

  const post = await postPromise;

  if (!post) throw new Error("Post not found");

  const postAuthorId = post.snapshots[0]?.authorId ?? null;

  const [replyParticipantCount, authorReplyCount] = await Promise.all([
    participantCountPromise,
    postAuthorId
      ? prisma.reply.count({
          where: {
            postId: id,
            authorId: postAuthorId,
          },
        })
      : Promise.resolve(0),
  ]);

  return {
    ...post,
    _replyParticipantCount: replyParticipantCount,
    _authorHasReplied: authorReplyCount > 0,
  };
}

export async function getPostBasicInfo(id: number) {
  const postPromise = prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      _count: {
        select: {
          replies: true,
        },
      },
    },
  });

  const authorsPromise = prisma.user.findMany({
    where: {
      postSnapshots: {
        some: { postId: id },
      },
    },
    select: {
      id: true,
    },
  });

  const [post, authors] = await Promise.all([postPromise, authorsPromise]);

  if (!post) throw new Error("Post not found");

  return {
    ...post,
    authors,
  };
}

export async function getPostRepliesWithLatestSnapshot(
  postId: number,
  {
    orderBy = "time_asc",
    takeAfterReply,
    take = 10,
    skip = 0,
  }: {
    orderBy: "time_asc" | "time_desc";
    takeAfterReply?: number;
    take: number;
    skip: number;
  } = {
    orderBy: "time_asc",
    take: 10,
    skip: 0,
  },
) {
  return await prisma.reply.findMany({
    where: { postId },
    orderBy:
      orderBy === "time_asc"
        ? [{ time: "asc" }, { id: "asc" }]
        : [{ time: "desc" }, { id: "desc" }],
    ...(takeAfterReply !== undefined
      ? {
          cursor: { id: takeAfterReply },
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
      snapshots: {
        orderBy: { capturedAt: "desc" },
        take: 1,
      },
      takedown: true,
      _count: {
        select: { snapshots: true },
      },
    },
  });
}

export async function getPostSummaryWithLatestSnapshot(postId: number) {
  return prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      time: true,
      snapshots: {
        orderBy: { capturedAt: "desc" },
        take: 1,
        select: {
          title: true,
          capturedAt: true,
          lastSeenAt: true,
          forum: {
            select: {
              slug: true,
              name: true,
            },
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
}

type TimelineChangedField = "title" | "content" | "author" | "forum";

interface PostSnapshotTimelineResult {
  capturedAt: Date;
  lastSeenAt: Date;
  title: string;
  author: {
    id: number;
    name: string;
    badge: string | null;
    color: string;
    ccfLevel: number;
    xcpcLevel: number;
  } | null;
  forum: {
    slug: string;
    name: string;
  };
  changedFields: TimelineChangedField[];
  hasPrevious: boolean;
}

export async function getPostSnapshotByCapturedAt(
  postId: number,
  capturedAt: Date,
) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      snapshots: {
        where: { capturedAt },
        take: 1,
        include: {
          author: {
            include: {
              snapshots: {
                orderBy: { capturedAt: "desc" },
                take: 1,
              },
            },
          },
          forum: true,
        },
      },
      takedown: true,
      _count: {
        select: {
          replies: true,
          snapshots: true,
        },
      },
    },
  });

  if (!post) {
    return null;
  }

  const snapshot = post.snapshots[0];
  if (!snapshot) {
    return null;
  }

  return {
    post,
    snapshot,
  };
}

export async function getPostSnapshotsTimeline(
  postId: number,
  {
    cursorCapturedAt,
    take = 10,
  }: {
    cursorCapturedAt?: Date;
    take?: number;
  } = {},
): Promise<{
  items: PostSnapshotTimelineResult[];
  hasMore: boolean;
  nextCursor: Date | null;
}> {
  const snapshots = await prisma.postSnapshot.findMany({
    where: { postId },
    orderBy: { capturedAt: "desc" },
    ...(cursorCapturedAt
      ? {
          cursor: {
            postId_capturedAt: {
              postId,
              capturedAt: cursorCapturedAt,
            },
          },
          skip: 1,
        }
      : {}),
    take: take + 1,
    include: {
      forum: true,
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

  if (snapshots.length === 0) {
    return {
      items: [],
      hasMore: false,
      nextCursor: null,
    };
  }

  const hasMore = snapshots.length > take;
  const trimmed = hasMore ? snapshots.slice(0, take) : snapshots;

  const items: PostSnapshotTimelineResult[] = trimmed.map((snapshot, index) => {
    const previous = snapshots[index + 1];
    const changedFields: TimelineChangedField[] = [];

    if (previous) {
      if (snapshot.title !== previous.title) {
        changedFields.push("title");
      }

      if (snapshot.content !== previous.content) {
        changedFields.push("content");
      }

      if (snapshot.authorId !== previous.authorId) {
        changedFields.push("author");
      } else {
        const currentAuthor = snapshot.author.snapshots[0];
        const previousAuthor = previous.author.snapshots[0];
        if (
          currentAuthor?.name !== previousAuthor?.name ||
          currentAuthor?.badge !== previousAuthor?.badge ||
          currentAuthor?.color !== previousAuthor?.color
        ) {
          changedFields.push("author");
        }
      }

      if (snapshot.forumSlug !== previous.forumSlug) {
        changedFields.push("forum");
      }
    }

    const authorSnapshot = snapshot.author.snapshots[0];

    return {
      capturedAt: snapshot.capturedAt,
      lastSeenAt: snapshot.lastSeenAt,
      title: snapshot.title,
      hasPrevious: Boolean(previous),
      author: authorSnapshot
        ? {
            id: snapshot.authorId,
            name: authorSnapshot.name,
            badge: authorSnapshot.badge,
            color: authorSnapshot.color,
            ccfLevel: authorSnapshot.ccfLevel,
            xcpcLevel: authorSnapshot.xcpcLevel,
          }
        : null,
      forum: {
        slug: snapshot.forum.slug,
        name: snapshot.forum.name,
      },
      changedFields,
    };
  });

  const lastItem = trimmed.length > 0 ? trimmed[trimmed.length - 1] : undefined;

  return {
    items,
    hasMore,
    nextCursor: hasMore && lastItem ? lastItem.capturedAt : null,
  };
}

export async function getReplyWithLatestSnapshot(replyId: number) {
  return prisma.reply.findUnique({
    where: { id: replyId },
    include: {
      author: {
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
      takedown: true,
      post: {
        select: {
          id: true,
        },
      },
      _count: {
        select: { snapshots: true },
      },
    },
  });
}
