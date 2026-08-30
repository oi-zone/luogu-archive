import {
  and,
  asc,
  count,
  countDistinct,
  db,
  desc,
  eq,
  exists,
  gt,
  inArray,
  lt,
  notExists,
  or,
  schema,
  sql,
} from "@luogu-discussion-archive/db";

import type { ForumDto, PostEntryPreviewDto } from "./dto.js";
import { getLuoguAvatar } from "./user-profile.js";
import {
  publicPostCondition,
  verifiedPostSnapshotCondition,
  verifiedReplySnapshotCondition,
} from "./visibility.js";

function visibleReplyCondition() {
  return and(
    notExists(
      db
        .select({ replyId: schema.ReplyTakedown.replyId })
        .from(schema.ReplyTakedown)
        .where(eq(schema.ReplyTakedown.replyId, schema.Reply.id)),
    ),
    exists(
      db
        .select({ replyId: schema.ReplySnapshot.replyId })
        .from(schema.ReplySnapshot)
        .where(
          and(
            eq(schema.ReplySnapshot.replyId, schema.Reply.id),
            verifiedReplySnapshotCondition(),
          ),
        ),
    ),
  );
}

async function isPostPublic(id: number) {
  const [post] = await db
    .select({ id: schema.Post.id })
    .from(schema.Post)
    .where(and(eq(schema.Post.id, id), publicPostCondition()))
    .limit(1);
  return Boolean(post);
}

export async function getPostWithSnapshot(id: number, capturedAt?: Date) {
  const post = await db.query.Post.findFirst({
    where: and(eq(schema.Post.id, id), publicPostCondition()),
    with: {
      snapshots: {
        orderBy: desc(schema.PostSnapshot.capturedAt),
        limit: 1,
        where: capturedAt
          ? and(
              eq(schema.PostSnapshot.capturedAt, capturedAt),
              verifiedPostSnapshotCondition(),
            )
          : verifiedPostSnapshotCondition(),
        with: {
          author: {
            with: {
              snapshots: {
                orderBy: desc(schema.UserSnapshot.capturedAt),
                limit: 1,
              },
            },
          },
          forum: {
            columns: {
              slug: true,
              name: true,
              problemId: true,
            },
            with: {
              problem: {
                columns: {
                  pid: true,
                  title: true,
                  difficulty: true,
                },
              },
            },
          },
        },
      },
      takedown: true,
    },
  });

  if (!post?.snapshots[0]?.author.snapshots[0]) {
    return null;
  }

  const [replyCountRow] = await db
    .select({ total: count() })
    .from(schema.Reply)
    .where(and(eq(schema.Reply.postId, id), visibleReplyCondition()));
  const [snapshotCountRow] = await db
    .select({ total: count() })
    .from(schema.PostSnapshot)
    .where(
      and(eq(schema.PostSnapshot.postId, id), verifiedPostSnapshotCondition()),
    );

  const [participantRow] = await db
    .select({ participants: countDistinct(schema.Reply.authorId) })
    .from(schema.Reply)
    .where(and(eq(schema.Reply.postId, id), visibleReplyCondition()));

  const postAuthorId = post.snapshots[0].authorId;
  const [authorReplyRow] = postAuthorId
    ? await db
        .select({ total: count() })
        .from(schema.Reply)
        .where(
          and(
            eq(schema.Reply.postId, id),
            eq(schema.Reply.authorId, postAuthorId),
            visibleReplyCondition(),
          ),
        )
    : [{ total: 0 }];

  return {
    ...post,
    _count: {
      replies: replyCountRow?.total ?? 0,
      snapshots: snapshotCountRow?.total ?? 0,
    },
    _replyParticipantCount: participantRow?.participants ?? 0,
    _authorHasReplied: (authorReplyRow?.total ?? 0) > 0,
  };
}

export async function getPostBasicInfo(id: number) {
  const [post] = await db
    .select({
      id: schema.Post.id,
    })
    .from(schema.Post)
    .where(and(eq(schema.Post.id, id), publicPostCondition()))
    .limit(1);

  if (!post) return null;

  const [replyCountRow] = await db
    .select({ total: count() })
    .from(schema.Reply)
    .where(and(eq(schema.Reply.postId, id), visibleReplyCondition()));

  const authors = await db
    .select({ id: schema.PostSnapshot.authorId })
    .from(schema.PostSnapshot)
    .where(
      and(eq(schema.PostSnapshot.postId, id), verifiedPostSnapshotCondition()),
    )
    .groupBy(schema.PostSnapshot.authorId);

  return {
    id: post.id,
    _count: {
      replies: replyCountRow?.total ?? 0,
    },
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
  if (!(await isPostPublic(postId))) return [];

  const orderExpressions =
    orderBy === "time_asc"
      ? [asc(schema.Reply.time), asc(schema.Reply.id)]
      : [desc(schema.Reply.time), desc(schema.Reply.id)];

  let whereClause = and(
    eq(schema.Reply.postId, postId),
    visibleReplyCondition(),
  );

  if (takeAfterReply !== undefined) {
    const [cursorRow] = await db
      .select({
        id: schema.Reply.id,
        time: schema.Reply.time,
      })
      .from(schema.Reply)
      .where(eq(schema.Reply.id, takeAfterReply))
      .limit(1);

    if (!cursorRow) {
      return [];
    }

    const comparator =
      orderBy === "time_asc"
        ? or(
            gt(schema.Reply.time, cursorRow.time),
            and(
              eq(schema.Reply.time, cursorRow.time),
              gt(schema.Reply.id, cursorRow.id),
            ),
          )
        : or(
            lt(schema.Reply.time, cursorRow.time),
            and(
              eq(schema.Reply.time, cursorRow.time),
              lt(schema.Reply.id, cursorRow.id),
            ),
          );

    const combined = and(whereClause, comparator);
    if (!combined) {
      return [];
    }

    whereClause = combined;
  }

  const replies = await db.query.Reply.findMany({
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
      snapshots: {
        where: verifiedReplySnapshotCondition(),
        orderBy: desc(schema.ReplySnapshot.capturedAt),
        limit: 1,
      },
      takedown: true,
    },
  });

  const replyIds = replies.map((reply) => reply.id);
  const snapshotCounts = replyIds.length
    ? await db
        .select({
          replyId: schema.ReplySnapshot.replyId,
          total: count(),
        })
        .from(schema.ReplySnapshot)
        .where(
          and(
            inArray(schema.ReplySnapshot.replyId, replyIds),
            verifiedReplySnapshotCondition(),
          ),
        )
        .groupBy(schema.ReplySnapshot.replyId)
    : [];
  const snapshotCountMap = new Map(
    snapshotCounts.map((row) => [row.replyId, row.total]),
  );

  return replies.map((reply) => ({
    ...reply,
    _count: {
      snapshots: snapshotCountMap.get(reply.id) ?? 0,
    },
  }));
}

interface ReplyCursorCandidate {
  id: number;
  postId: number;
  authorId: number;
  time: Date;
}

function buildBeforeCursorWhere(
  postId: number,
  authorId: number,
  cursor: ReplyCursorCandidate,
) {
  return and(
    eq(schema.Reply.postId, postId),
    eq(schema.Reply.authorId, authorId),
    visibleReplyCondition(),
    or(
      lt(schema.Reply.time, cursor.time),
      and(eq(schema.Reply.time, cursor.time), lt(schema.Reply.id, cursor.id)),
    ),
  );
}

function buildAfterCursorWhere(
  postId: number,
  authorId: number,
  cursor: ReplyCursorCandidate,
) {
  return and(
    eq(schema.Reply.postId, postId),
    eq(schema.Reply.authorId, authorId),
    visibleReplyCondition(),
    or(
      gt(schema.Reply.time, cursor.time),
      and(eq(schema.Reply.time, cursor.time), gt(schema.Reply.id, cursor.id)),
    ),
  );
}

async function resolveReplyCursor({
  postId,
  authorId,
  cursorReplyId,
  relativeToReplyId,
}: {
  postId: number;
  authorId: number;
  cursorReplyId?: number;
  relativeToReplyId?: number;
}): Promise<ReplyCursorCandidate | null> {
  const baseSelect = {
    id: schema.Reply.id,
    postId: schema.Reply.postId,
    authorId: schema.Reply.authorId,
    time: schema.Reply.time,
  };

  if (cursorReplyId) {
    const [cursor] = await db
      .select(baseSelect)
      .from(schema.Reply)
      .where(and(eq(schema.Reply.id, cursorReplyId), visibleReplyCondition()))
      .limit(1);

    if (!cursor) {
      return null;
    }

    if (cursor.postId !== postId || cursor.authorId !== authorId) {
      return null;
    }

    return cursor;
  }

  if (relativeToReplyId) {
    const [relative] = await db
      .select(baseSelect)
      .from(schema.Reply)
      .where(
        and(eq(schema.Reply.id, relativeToReplyId), visibleReplyCondition()),
      )
      .limit(1);

    if (!relative) {
      return null;
    }

    if (relative.postId !== postId) {
      return null;
    }

    const [candidateBefore] = await db
      .select(baseSelect)
      .from(schema.Reply)
      .where(buildBeforeCursorWhere(postId, authorId, relative))
      .orderBy(desc(schema.Reply.time), desc(schema.Reply.id))
      .limit(1);

    if (candidateBefore) {
      return candidateBefore;
    }

    const [candidateAfter] = await db
      .select(baseSelect)
      .from(schema.Reply)
      .where(buildAfterCursorWhere(postId, authorId, relative))
      .orderBy(asc(schema.Reply.time), asc(schema.Reply.id))
      .limit(1);

    if (candidateAfter) {
      return candidateAfter;
    }

    return null;
  }

  const [latest] = await db
    .select(baseSelect)
    .from(schema.Reply)
    .where(
      and(
        eq(schema.Reply.postId, postId),
        eq(schema.Reply.authorId, authorId),
        visibleReplyCondition(),
      ),
    )
    .orderBy(desc(schema.Reply.time), desc(schema.Reply.id))
    .limit(1);

  return latest ?? null;
}

export async function getPostUserReplyInference({
  postId,
  userId,
  cursorReplyId,
  relativeToReplyId,
}: {
  postId: number;
  userId: number;
  cursorReplyId?: number;
  relativeToReplyId?: number;
}) {
  if (!(await isPostPublic(postId))) {
    return {
      current: null,
      previousReplyId: null,
      nextReplyId: null,
    } as const;
  }

  const cursor = await resolveReplyCursor({
    postId,
    authorId: userId,
    ...(cursorReplyId ? { cursorReplyId } : {}),
    ...(relativeToReplyId ? { relativeToReplyId } : {}),
  });

  if (!cursor) {
    return {
      current: null,
      previousReplyId: null,
      nextReplyId: null,
    } as const;
  }

  const [current, previousRows, nextRows] = await Promise.all([
    getReplyWithLatestSnapshot(cursor.id),
    db
      .select({ id: schema.Reply.id })
      .from(schema.Reply)
      .where(buildBeforeCursorWhere(postId, userId, cursor))
      .orderBy(desc(schema.Reply.time), desc(schema.Reply.id))
      .limit(1),
    db
      .select({ id: schema.Reply.id })
      .from(schema.Reply)
      .where(buildAfterCursorWhere(postId, userId, cursor))
      .orderBy(asc(schema.Reply.time), asc(schema.Reply.id))
      .limit(1),
  ]);

  const previous = previousRows[0];
  const next = nextRows[0];

  return {
    current,
    previousReplyId: previous?.id ?? null,
    nextReplyId: next?.id ?? null,
  } as const;
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
  forum: ForumDto;
  changedFields: TimelineChangedField[];
  hasPrevious: boolean;
}

export async function getPostSnapshotByCapturedAt(
  postId: number,
  capturedAt: Date,
) {
  const post = await getPostWithSnapshot(postId, capturedAt).catch(() => null);

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
} | null> {
  if (!(await isPostPublic(postId))) return null;

  const snapshots = await db.query.PostSnapshot.findMany({
    where: cursorCapturedAt
      ? and(
          eq(schema.PostSnapshot.postId, postId),
          lt(schema.PostSnapshot.capturedAt, cursorCapturedAt),
          verifiedPostSnapshotCondition(),
        )
      : and(
          eq(schema.PostSnapshot.postId, postId),
          verifiedPostSnapshotCondition(),
        ),
    orderBy: desc(schema.PostSnapshot.capturedAt),
    limit: take + 1,
    with: {
      forum: {
        columns: {
          slug: true,
          name: true,
          problemId: true,
        },
        with: {
          problem: {
            columns: {
              pid: true,
              title: true,
              difficulty: true,
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
      forum: snapshot.forum,
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
  const [replyParent] = await db
    .select({ postId: schema.Reply.postId })
    .from(schema.Reply)
    .where(and(eq(schema.Reply.id, replyId), visibleReplyCondition()))
    .limit(1);
  if (!replyParent || !(await isPostPublic(replyParent.postId))) return null;

  const reply = await db.query.Reply.findFirst({
    where: and(eq(schema.Reply.id, replyId), visibleReplyCondition()),
    with: {
      author: {
        with: {
          snapshots: {
            orderBy: desc(schema.UserSnapshot.capturedAt),
            limit: 1,
          },
        },
      },
      snapshots: {
        where: verifiedReplySnapshotCondition(),
        orderBy: desc(schema.ReplySnapshot.capturedAt),
        limit: 1,
      },
      takedown: true,
      post: {
        columns: {
          id: true,
          public: true,
        },
      },
    },
  });

  if (!reply?.post.public || reply.takedown.length > 0 || !reply.snapshots[0]) {
    return null;
  }

  const [snapshotCountRow] = await db
    .select({ total: count() })
    .from(schema.ReplySnapshot)
    .where(
      and(
        eq(schema.ReplySnapshot.replyId, replyId),
        verifiedReplySnapshotCondition(),
      ),
    );

  return {
    ...reply,
    _count: {
      snapshots: snapshotCountRow?.total ?? 0,
    },
  };
}

export async function getPostEntries(
  ids: number[],
): Promise<PostEntryPreviewDto[]> {
  if (ids.length === 0) return [];

  const posts = await db.query.Post.findMany({
    where: and(inArray(schema.Post.id, ids), publicPostCondition()),
    with: {
      snapshots: {
        where: verifiedPostSnapshotCondition(),
        columns: {
          content: false,
          title: false,
          pinnedReplyId: false,
          exposureState: false,
          verifiedPublicAt: false,
          verifiedSource: false,
        },
        extras: {
          title: sql<string>`left(${schema.PostSnapshot.title}, 512)`.as(
            "entry_title",
          ),
          preview: sql<string>`left(${schema.PostSnapshot.content}, 512)`.as(
            "entry_preview",
          ),
        },
        orderBy: desc(schema.PostSnapshot.capturedAt),
        limit: 1,
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
                  >`left(${schema.UserSnapshot.badge}, 128)`.as(
                    "entry_user_badge",
                  ),
                },
                orderBy: desc(schema.UserSnapshot.capturedAt),
                limit: 1,
              },
            },
          },
          forum: {
            columns: { slug: true, name: false },
            extras: {
              name: sql<string>`left(${schema.Forum.name}, 128)`.as(
                "entry_forum_name",
              ),
            },
            with: {
              problem: {
                columns: { pid: true, title: false, difficulty: true },
                extras: {
                  title: sql<string>`left(${schema.Problem.title}, 512)`.as(
                    "entry_problem_title",
                  ),
                },
              },
            },
          },
        },
      },
    },
    extras: {
      savedReplyCount: db
        .$count(
          schema.Reply,
          eq(
            schema.Post.id,
            sql`${schema.Reply}.${sql.identifier(schema.Reply.postId.name)}`,
          ),
        )
        .mapWith(Number)
        .as("saved_reply_count"),
      snapshotCount: db
        .$count(
          schema.PostSnapshot,
          eq(
            schema.Post.id,
            sql`${schema.PostSnapshot}.${sql.identifier(
              schema.PostSnapshot.postId.name,
            )}`,
          ),
        )
        .mapWith(Number)
        .as("snapshot_count"),
    },
  });

  return posts.flatMap((post) =>
    post.snapshots.flatMap((snapshot) =>
      snapshot.author.snapshots.map((authorSnapshot) => ({
        id: post.id,
        title: snapshot.title,
        author: {
          name: authorSnapshot.name,
          badge: authorSnapshot.badge,
          color: authorSnapshot.color,
          ccfLevel: authorSnapshot.ccfLevel,
          xcpcLevel: authorSnapshot.xcpcLevel,
          uid: snapshot.authorId,
          avatar: getLuoguAvatar(snapshot.authorId),
        },
        time: post.time.getTime() / 1000,
        forum: snapshot.forum,
        replyCount: post.replyCount,
        preview: snapshot.preview,

        savedReplyCount: post.savedReplyCount,
        snapshotCount: post.snapshotCount,
      })),
    ),
  );
}
