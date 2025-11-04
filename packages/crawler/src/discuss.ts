import type {
  Forum,
  Post,
  PostDetails,
  Reply,
  ReplySummary,
} from "@lgjs/types";

import { prisma } from "@luogu-discussion-archive/db";

import { clientLentille } from "./client.js";
import { AccessError } from "./error.js";
import { PgAdvisoryLock } from "./locks.js";
import { saveProblem } from "./problem.js";
import { saveUserSnapshot } from "./user.js";

async function saveForum(forum: Forum, now: Date | string) {
  if (forum.problem) await saveProblem(forum.problem, now);

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

async function saveReply(
  reply: ReplySummary,
  postId: number,
  now: Date | string,
) {
  await saveUserSnapshot(reply.author, now);

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

async function saveReplySnapshot(
  reply: Reply,
  postId: number,
  now: Date | string,
) {
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

export async function savePostSnapshot(post: PostDetails, now: Date | string) {
  await Promise.all([
    saveUserSnapshot(post.author, now),
    saveForum(post.forum, now),
    savePost(post, now),
  ]);

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

export async function fetchDiscuss(id: number, page: number) {
  const { status, data, time } = await (
    await clientLentille.get("discuss.show", {
      params: { id },
      query: { page },
    })
  ).json();
  if (status !== 200)
    throw new AccessError("Failed to fetch discussion", status);
  const now = new Date(time * 1000);
  await savePostSnapshot(data.post, now);

  const replies = data.replies.result as Reply[];
  if (data.post.pinnedReply) replies.push(data.post.pinnedReply);
  const [replySnapshots] = await Promise.all([
    Promise.all(
      replies.map((reply) => saveReplySnapshot(reply, data.post.id, now)),
    ),
    ...(data.post.recentReply
      ? [saveReply(data.post.recentReply, data.post.id, now)]
      : []),
  ]);

  return {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    numPages: Math.ceil(data.replies.count / data.replies.perPage!),
    numReplies: replies.length,
    numNewReplies: replySnapshots.filter(
      ({ capturedAt }) => capturedAt.getTime() === now.getTime(),
    ).length,
  };
}
