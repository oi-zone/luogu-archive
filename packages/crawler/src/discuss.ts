import type {
  Forum,
  Post,
  PostDetails,
  ProblemSummary,
  Reply,
  ReplySummary,
} from "@lgjs/types";

import { prisma } from "@luogu-discussion-archive/db";
import { db, schema, sql } from "@luogu-discussion-archive/db/drizzle";

import { clientLentille } from "./client.js";
import { AccessError, HttpError } from "./error.js";
import { PgAdvisoryLock } from "./locks.js";
import { saveProblems } from "./problem.js";
import { saveUserSnapshots } from "./user.js";

export const REPLIES_PER_PAGE = 10;

async function saveForums(forums: Forum[], now: Date) {
  await saveProblems(
    forums
      .map((forum) => forum.problem)
      .filter((problem): problem is ProblemSummary => Boolean(problem)),
    now,
  );

  return db
    .insert(schema.Forum)
    .values(
      forums.map((forum) => ({
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

const saveReplies = (replies: { postId: number; reply: ReplySummary }[]) =>
  db
    .insert(schema.Reply)
    .values(
      replies.map(({ postId, reply }) => ({
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

const saveReplySnapshot = async (reply: Reply, now: Date) =>
  prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PgAdvisoryLock.Reply}::INT4, ${reply.id}::INT4);`;

    const lastSnapshot = await tx.replySnapshot.findFirst({
      where: {
        replyId: reply.id,
      },
      orderBy: {
        capturedAt: "desc",
      },
    });

    if (lastSnapshot && lastSnapshot.content === reply.content)
      return tx.replySnapshot.update({
        where: {
          replyId_capturedAt: {
            replyId: reply.id,
            capturedAt: lastSnapshot.capturedAt,
          },
        },
        data: { lastSeenAt: now },
      });

    return tx.replySnapshot.create({
      data: {
        replyId: reply.id,
        content: reply.content,
        capturedAt: now,
        lastSeenAt: now,
      },
    });
  });

const savePosts = (posts: Post[], now: Date) =>
  db
    .insert(schema.Post)
    .values(
      posts.map((post) => ({
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

async function savePostSnapshot(post: PostDetails, now: Date) {
  await saveForums([post.forum], now);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PgAdvisoryLock.Post}::INT4, ${post.id}::INT4);`;

    const lastSnapshot = await tx.postSnapshot.findFirst({
      where: {
        postId: post.id,
      },
      orderBy: {
        capturedAt: "desc",
      },
    });

    if (
      lastSnapshot &&
      lastSnapshot.title === post.title &&
      lastSnapshot.authorId === post.author.uid &&
      lastSnapshot.forumSlug === post.forum.slug &&
      lastSnapshot.content === post.content
    )
      return tx.postSnapshot.update({
        where: {
          postId_capturedAt: {
            postId: post.id,
            capturedAt: lastSnapshot.capturedAt,
          },
        },
        data: { lastSeenAt: now },
      });

    return tx.postSnapshot.create({
      data: {
        postId: post.id,
        title: post.title,
        authorId: post.author.uid,
        forumSlug: post.forum.slug,
        content: post.content,
        capturedAt: now,
        lastSeenAt: now,
      },
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
    numNewReplies: replySnapshots.filter(
      ({ capturedAt }) => capturedAt.getTime() === now.getTime(),
    ).length,
    recentReply,
    recentReplySnapshot: recentReply
      ? await prisma.replySnapshot.findFirst({
          select: { replyId: true, capturedAt: true, lastSeenAt: true },
          where: { replyId: recentReply.id },
        })
      : null,
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
