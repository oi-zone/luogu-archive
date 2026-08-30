import type {
  Forum,
  Post,
  PostDetails,
  ProblemSummary,
  Reply,
  ReplySummary,
} from "@lgjs/types";

import {
  and,
  db,
  eq,
  isNull,
  max,
  schema,
  sql,
} from "@luogu-discussion-archive/db";

import { publicLentille } from "./client.js";
import { AccessError, HttpError, UnexpectedStatusError } from "./error.js";
import {
  expectArray,
  expectFiniteNumber,
  expectPositiveInteger,
  expectRecord,
  validateBoundedPayload,
} from "./http.js";
import { PgAdvisoryLock } from "./locks.js";
import {
  validatePost,
  validatePostDetails,
  validateReply,
} from "./payload-validation.js";
import { saveProblems } from "./problem.js";
import { saveUserSnapshots } from "./user.js";
import { deduplicate } from "./utils.js";

export const REPLIES_PER_PAGE = 10;
const MAX_DISCUSSION_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_DISCUSSION_LIST_BYTES = 2 * 1024 * 1024;
const MAX_DISCUSSION_REPLIES = 200;
const MAX_DISCUSSION_LIST_ITEMS = 100;
const ANONYMOUS_SOURCE = "anonymous_upstream";

function validateDiscussionResponse(value: unknown) {
  const root = expectRecord(value, "discuss.show");
  const status = expectFiniteNumber(root.status, "discuss.show.status");
  if (status !== 200) {
    return { status, time: 0, data: null };
  }
  validateBoundedPayload(value, "discuss.show");
  const data = expectRecord(root.data, "discuss.show");
  const post = validatePostDetails(data.post, "discuss.show.post");
  const replies = expectRecord(data.replies, "discuss.show");
  const result = expectArray<unknown>(
    replies.result,
    "discuss.show.replies",
    MAX_DISCUSSION_REPLIES,
  ).map((reply, index) =>
    validateReply(reply, `discuss.show.replies[${String(index)}]`),
  );
  const time = expectFiniteNumber(root.time, "discuss.show.time");
  expectPositiveInteger(post.id, "discuss.show.post.id");
  if (!Number.isSafeInteger(replies.count) || (replies.count as number) < 0)
    throw new Error("Invalid discuss.show.replies.count");
  expectPositiveInteger(replies.perPage, "discuss.show.replies.perPage");
  return {
    status,
    time,
    data: {
      post,
      replies: {
        result,
        count: replies.count as number,
        perPage: replies.perPage as number,
      },
    },
  };
}

function validateDiscussionListResponse(value: unknown) {
  validateBoundedPayload(value, "discuss.list");
  const root = expectRecord(value, "discuss.list");
  const data = expectRecord(root.data, "discuss.list");
  const postsContainer = expectRecord(data.posts, "discuss.list");
  const posts = expectArray<unknown>(
    postsContainer.result,
    "discuss.list.posts",
    MAX_DISCUSSION_LIST_ITEMS,
  ).map((post, index) =>
    validatePost(post, `discuss.list.posts[${String(index)}]`),
  );
  expectFiniteNumber(root.status, "discuss.list.status");
  expectFiniteNumber(root.time, "discuss.list.time");
  for (const post of posts)
    expectPositiveInteger(post.id, "discuss.list.post.id");
  return {
    status: root.status as number,
    time: root.time as number,
    data: { posts: { result: posts } },
  };
}

async function saveForums(forums: Forum[], now: Date) {
  const deduplicatedForums = deduplicate(forums, (forum) => forum.slug);
  if (!deduplicatedForums.length) return Promise.resolve();

  await saveProblems(
    deduplicatedForums
      .map((forum) => forum.problem)
      .filter((problem): problem is ProblemSummary => Boolean(problem)),
    now,
  );

  return db
    .insert(schema.Forum)
    .values(
      deduplicatedForums.map((forum) => ({
        name: forum.name,
        type: forum.type,
        slug: forum.slug,
        color: forum.color,
        problemId: forum.problem?.pid ?? null,
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: [schema.Forum.slug],
      set: {
        name: sql.raw(`excluded."${schema.Forum.name.name}"`),
        type: sql.raw(`excluded."${schema.Forum.type.name}"`),
        color: sql.raw(`excluded."${schema.Forum.color.name}"`),
        problemId: sql.raw(`excluded."${schema.Forum.problemId.name}"`),
        updatedAt: sql.raw(`excluded."${schema.Forum.updatedAt.name}"`),
      },
    });
}

async function saveReplies(replies: { postId: number; reply: ReplySummary }[]) {
  const deduplicatedReplies = deduplicate(replies, (reply) => reply.reply.id);
  if (!deduplicatedReplies.length) return Promise.resolve();

  return db
    .insert(schema.Reply)
    .values(
      deduplicatedReplies.map(({ postId, reply }) => ({
        id: reply.id,
        postId,
        authorId: reply.author.uid,
        time: new Date(reply.time * 1000),
      })),
    )
    .onConflictDoUpdate({
      target: [schema.Reply.id],
      set: {
        postId: sql.raw(`excluded."${schema.Reply.postId.name}"`),
        authorId: sql.raw(`excluded."${schema.Reply.authorId.name}"`),
        time: sql.raw(`excluded."${schema.Reply.time.name}"`),
      },
    });
}

const saveReplySnapshot = async (reply: Reply, now: Date) =>
  db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(${PgAdvisoryLock.Reply}::int4, ${reply.id}::int4)`,
    );

    const lastCaptured = tx
      .select({ val: max(schema.ReplySnapshot.capturedAt) })
      .from(schema.ReplySnapshot)
      .where(eq(schema.ReplySnapshot.replyId, reply.id));

    const { rowCount } = await tx
      .update(schema.ReplySnapshot)
      .set({
        lastSeenAt: now,
        exposureState: "public",
        verifiedPublicAt: now,
        verifiedSource: ANONYMOUS_SOURCE,
      })
      .where(
        and(
          eq(schema.ReplySnapshot.replyId, reply.id),
          eq(schema.ReplySnapshot.capturedAt, lastCaptured),

          eq(schema.ReplySnapshot.content, reply.content),
        ),
      );

    if (rowCount === 0)
      return tx.insert(schema.ReplySnapshot).values({
        replyId: reply.id,
        content: reply.content,
        exposureState: "public",
        verifiedPublicAt: now,
        verifiedSource: ANONYMOUS_SOURCE,
        capturedAt: now,
        lastSeenAt: now,
      });
  });

async function savePosts(posts: Post[], now: Date) {
  const deduplicatedPosts = deduplicate(posts, (post) => post.id);
  if (!deduplicatedPosts.length) return Promise.resolve();

  return db
    .insert(schema.Post)
    .values(
      deduplicatedPosts.map((post) => ({
        id: post.id,
        time: new Date(post.time * 1000),
        replyCount: post.replyCount,
        topped: post.topped,
        locked: post.locked,
        public: true,
        visibilityState: "public",
        visibilityCheckedAt: now,
        visibilitySource: ANONYMOUS_SOURCE,
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: [schema.Post.id],
      set: {
        time: sql.raw(`excluded."${schema.Post.time.name}"`),
        replyCount: sql.raw(`excluded."${schema.Post.replyCount.name}"`),
        public: sql.raw(`excluded."${schema.Post.public.name}"`),
        visibilityState: sql.raw(
          `excluded."${schema.Post.visibilityState.name}"`,
        ),
        visibilityCheckedAt: sql.raw(
          `excluded."${schema.Post.visibilityCheckedAt.name}"`,
        ),
        visibilitySource: sql.raw(
          `excluded."${schema.Post.visibilitySource.name}"`,
        ),
        updatedAt: sql.raw(`excluded."${schema.Post.updatedAt.name}"`),
      },
    });
}

async function savePostSnapshot(post: PostDetails, now: Date) {
  await saveForums([post.forum], now);

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(${PgAdvisoryLock.Post}::int4, ${post.id}::int4)`,
    );

    const lastCaptured = tx
      .select({ val: max(schema.PostSnapshot.capturedAt) })
      .from(schema.PostSnapshot)
      .where(eq(schema.PostSnapshot.postId, post.id));

    const { rowCount } = await tx
      .update(schema.PostSnapshot)
      .set({
        lastSeenAt: now,
        exposureState: "public",
        verifiedPublicAt: now,
        verifiedSource: ANONYMOUS_SOURCE,
      })
      .where(
        and(
          eq(schema.PostSnapshot.postId, post.id),
          eq(schema.PostSnapshot.capturedAt, lastCaptured),

          eq(schema.PostSnapshot.title, post.title),
          eq(schema.PostSnapshot.authorId, post.author.uid),
          eq(schema.PostSnapshot.forumSlug, post.forum.slug),
          eq(schema.PostSnapshot.topped, post.topped),
          eq(schema.PostSnapshot.locked, post.locked),
          eq(schema.PostSnapshot.content, post.content),
          post.pinnedReply
            ? eq(schema.PostSnapshot.pinnedReplyId, post.pinnedReply.id)
            : isNull(schema.PostSnapshot.pinnedReplyId),
        ),
      );

    if (rowCount === 0)
      return tx.insert(schema.PostSnapshot).values({
        postId: post.id,
        title: post.title,
        authorId: post.author.uid,
        forumSlug: post.forum.slug,
        topped: post.topped,
        locked: post.locked,
        content: post.content,
        exposureState: "public",
        verifiedPublicAt: now,
        verifiedSource: ANONYMOUS_SOURCE,
        pinnedReplyId: post.pinnedReply?.id ?? null,
        capturedAt: now,
        lastSeenAt: now,
      });
  });
}

async function restrictPost(id: number) {
  await db
    .update(schema.Post)
    .set({
      public: false,
      visibilityState: "restricted",
      visibilityCheckedAt: new Date(),
      visibilitySource: ANONYMOUS_SOURCE,
      updatedAt: new Date(),
    })
    .where(eq(schema.Post.id, id));
}

export async function fetchDiscuss(id: number, page?: number) {
  let response: Awaited<
    ReturnType<
      typeof publicLentille.getJson<
        ReturnType<typeof validateDiscussionResponse>
      >
    >
  >;
  try {
    response = await publicLentille.getJson(
      "discuss.show",
      { params: { id }, query: page ? { page } : {} },
      {
        endpoint: "discuss.show",
        timeoutMs: 30_000,
        maxBytes: MAX_DISCUSSION_RESPONSE_BYTES,
        validate: validateDiscussionResponse,
      },
    );
  } catch (error) {
    if (
      error instanceof HttpError &&
      (error.status === 403 || error.status === 404)
    ) {
      await restrictPost(id);
      throw new AccessError(error.url, error.status);
    }
    throw error;
  }
  const { data: envelope, url } = response;
  const { status, data, time } = envelope;
  if (status === 403 || status === 404) {
    await restrictPost(id);
    throw new AccessError(url, status);
  }
  if (status !== 200)
    throw new UnexpectedStatusError("Unexpected status", url, status);
  if (!data)
    throw new UnexpectedStatusError("Missing discussion data", url, status);

  const now = new Date(time * 1000);
  const paginatedReplyCount = data.replies.result.length;
  const replies = data.replies.result;
  if (data.post.pinnedReply) replies.push(data.post.pinnedReply);

  await Promise.all([
    savePosts([data.post], now),
    saveUserSnapshots(
      replies
        .map((reply) => reply.author)
        .concat(data.post.author)
        .concat(data.post.recentReply ? data.post.recentReply.author : []),
      now,
    ),
  ]);

  const replySummaries: ReplySummary[] = [
    ...replies,
    ...(data.post.recentReply ? [data.post.recentReply] : []),
  ];
  await saveReplies(
    replySummaries.map((reply) => ({ postId: data.post.id, reply })),
  );
  const [replySnapshots] = await Promise.all([
    Promise.all(replies.map((reply) => saveReplySnapshot(reply, now))),
    savePostSnapshot(data.post, now),
  ]);

  return {
    numPages: Math.ceil(data.replies.count / data.replies.perPage),
    numReplies: paginatedReplyCount,
    numNewReplies: replySnapshots.slice(0, paginatedReplyCount).filter(Boolean)
      .length,
  };
}

export async function listDiscuss(forum: string | null = null, page?: number) {
  const { data: envelope, url } = await publicLentille.getJson(
    "discuss.list",
    { query: { ...(forum ? { forum } : {}), ...(page ? { page } : {}) } },
    {
      endpoint: "discuss.list",
      timeoutMs: 20_000,
      maxBytes: MAX_DISCUSSION_LIST_BYTES,
      validate: validateDiscussionListResponse,
    },
  );
  const { status, data, time } = envelope;
  if (status !== 200)
    throw new UnexpectedStatusError("Unexpected status", url, status);

  const now = new Date(time * 1000);
  const posts = data.posts.result;
  await Promise.all([
    saveForums(
      posts.map((post) => post.forum),
      now,
    ),
    saveUserSnapshots(
      posts
        .flatMap((post) =>
          post.recentReply ? ([post, post.recentReply] as const) : post,
        )
        .map(({ author }) => author),
      now,
    )
      .then(() => savePosts(posts, now))
      .then(() =>
        saveReplies(
          posts.flatMap(({ id, recentReply }) =>
            recentReply ? { postId: id, reply: recentReply } : [],
          ),
        ),
      ),
  ]);
  return posts;
}
