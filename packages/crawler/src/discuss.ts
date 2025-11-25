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
  max,
  schema,
  sql,
} from "@luogu-discussion-archive/db/drizzle";

import { clientLentille } from "./client.js";
import { AccessError, HttpError } from "./error.js";
import { PgAdvisoryLock } from "./locks.js";
import { saveProblems } from "./problem.js";
import { saveUserSnapshots } from "./user.js";
import { deduplicate } from "./utils.js";

export const REPLIES_PER_PAGE = 10;

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
        slug: forum.slug,
        name: forum.name,
        problemId: forum.problem?.pid ?? null,
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: [schema.Forum.slug],
      set: {
        name: sql.raw(`excluded."${schema.Forum.name.name}"`),
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
      .set({ lastSeenAt: now })
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
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: [schema.Post.id],
      set: {
        time: sql.raw(`excluded."${schema.Post.time.name}"`),
        replyCount: sql.raw(`excluded."${schema.Post.replyCount.name}"`),
        topped: sql.raw(`excluded."${schema.Post.topped.name}"`),
        locked: sql.raw(`excluded."${schema.Post.locked.name}"`),
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
      .set({ lastSeenAt: now })
      .where(
        and(
          eq(schema.PostSnapshot.postId, post.id),
          eq(schema.PostSnapshot.capturedAt, lastCaptured),

          eq(schema.PostSnapshot.title, post.title),
          eq(schema.PostSnapshot.authorId, post.author.uid),
          eq(schema.PostSnapshot.forumSlug, post.forum.slug),
          eq(schema.PostSnapshot.content, post.content),
        ),
      );

    if (rowCount === 0)
      return tx.insert(schema.PostSnapshot).values({
        postId: post.id,
        title: post.title,
        authorId: post.author.uid,
        forumSlug: post.forum.slug,
        content: post.content,
        capturedAt: now,
        lastSeenAt: now,
      });
  });
}

export async function fetchDiscuss(id: number, page?: number) {
  const res = await clientLentille.get("discuss.show", {
    params: { id },
    query: page ? { page } : {},
  });
  const { status, data, time } = await res.json().catch((err: unknown) => {
    throw res.ok ? err : new HttpError(res.url, res.status);
  });
  if (status === 403 || status === 404) throw new AccessError(res.url, status);
  if (status !== 200) throw new HttpError(res.url, status);

  const now = new Date(time * 1000);
  const replies = data.replies.result as Reply[];
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

  const [replySnapshots] = await Promise.all([
    saveReplies(
      (replies as ReplySummary[])
        .concat(data.post.recentReply ? data.post.recentReply : [])
        .map((reply) => ({ postId: data.post.id, reply })),
    ).then(() =>
      Promise.all(replies.map((reply) => saveReplySnapshot(reply, now))),
    ),
    savePostSnapshot(data.post, now),
  ]);

  const { recentReply } = data.post;
  return {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    numPages: Math.ceil(data.replies.count / data.replies.perPage!),
    numReplies: replies.length,
    numNewReplies: replySnapshots.filter(Boolean).length,
    recentReply,
    recentReplySnapshot: recentReply
      ? await db.query.ReplySnapshot.findFirst({
          columns: { capturedAt: true },
          where: eq(schema.ReplySnapshot.replyId, recentReply.id),
        })
      : undefined,
  };
}

export async function listDiscuss(forum: string | null = null, page?: number) {
  const res = await clientLentille.get("discuss.list", {
    query: { ...(forum ? { forum } : {}), ...(page ? { page } : {}) },
  });
  const { status, data, time } = await res.json().catch((err: unknown) => {
    throw res.ok ? err : new HttpError(res.url, res.status);
  });
  if (status !== 200) throw new HttpError(res.url, status);

  const now = new Date(time * 1000);
  const posts = data.posts.result as Post[];
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
