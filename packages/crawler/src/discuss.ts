import type {
  Forum,
  Post,
  PostDetails,
  Reply,
  ReplySummary,
} from "@lgjs/types";

import { prisma } from "@luogu-discussion-archive/db";

import { clientLentille } from "./client.js";
import { AccessError, HttpError } from "./error.js";
import { PgAdvisoryLock } from "./locks.js";
import { saveProblems } from "./problem.js";
import { saveUserSnapshots } from "./user.js";

export const REPLIES_PER_PAGE = 10;

async function saveForum(forum: Forum, now: Date) {
  if (forum.problem) await saveProblems([forum.problem], now);

  return prisma.forum.upsert({
    where: { slug: forum.slug },
    update: {
      slug: forum.slug,
      name: forum.name,
      problemId: forum.problem?.pid ?? null,
      updatedAt: now,
    },
    create: {
      slug: forum.slug,
      name: forum.name,
      problemId: forum.problem?.pid ?? null,
      updatedAt: now,
    },
  });
}

async function saveReply(reply: ReplySummary, postId: number, now: Date) {
  await saveUserSnapshots([reply.author], now);

  return prisma.reply.upsert({
    where: { id: reply.id },
    create: {
      id: reply.id,
      postId,
      authorId: reply.author.uid,
      time: new Date(reply.time * 1000),
    },
    update: {
      postId,
      authorId: reply.author.uid,
      time: new Date(reply.time * 1000),
    },
  });
}

async function saveReplySnapshot(reply: Reply, postId: number, now: Date) {
  await saveReply(reply, postId, now);

  return prisma.$transaction(async (tx) => {
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
}

const savePost = async (post: Post, now: Date | string) =>
  prisma.post.upsert({
    where: { id: post.id },
    create: {
      id: post.id,
      time: new Date(post.time * 1000),
      replyCount: post.replyCount,
      topped: post.topped,
      locked: post.locked,
      updatedAt: now,
    },
    update: {
      time: new Date(post.time * 1000),
      replyCount: post.replyCount,
      topped: post.topped,
      locked: post.locked,
      updatedAt: now,
    },
  });

const savePostMeta = (post: Post, now: Date) =>
  Promise.all([
    saveForum(post.forum, now),
    saveUserSnapshots([post.author], now),
  ]);

export async function savePostSnapshot(post: PostDetails, now: Date) {
  await savePostMeta(post, now);

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
  await savePost(data.post, now);
  const replies = data.replies.result as Reply[];
  if (data.post.pinnedReply) replies.push(data.post.pinnedReply);
  const [replySnapshots, recentReply] = await Promise.all([
    Promise.all(
      replies.map((reply) => saveReplySnapshot(reply, data.post.id, now)),
    ),
    data.post.recentReply
      ? saveReply(data.post.recentReply, data.post.id, now)
      : Promise.resolve(),
    savePostSnapshot(data.post, now),
  ]);

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
  return Promise.all(
    posts.map(async (post) => {
      const p = await savePost(post, now);
      await Promise.all([
        savePostMeta(post, now),
        post.recentReply
          ? saveReply(post.recentReply, post.id, now)
          : Promise.resolve(),
      ]);
      return p;
    }),
  );
}
