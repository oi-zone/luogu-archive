import type {
  Forum,
  Post,
  PostDetails,
  Reply,
  ReplySummary,
} from "@lgjs/types";

import { prisma } from "@luogu-discussion-archive/db";

import { client } from "./client.js";
import { PgAdvisoryLock } from "./locks.js";
import { saveUserSnapshot } from "./user.js";

const saveForum = (forum: Forum) =>
  prisma.forum.upsert({
    where: { slug: forum.slug },
    update: {
      slug: forum.slug,
      name: forum.name,
    },
    create: {
      slug: forum.slug,
      name: forum.name,
    },
  });

const saveReply = (reply: ReplySummary, postId: number) =>
  prisma.reply.upsert({
    where: { id: reply.id },
    create: {
      id: reply.id,
      postId,
      time: new Date(reply.time * 1000),
    },
    update: {
      postId,
      time: new Date(reply.time * 1000),
    },
  });

async function saveReplySnapshot(
  reply: Reply,
  postId: number,
  now: Date | string,
) {
  await Promise.all([
    saveUserSnapshot(reply.author, now),
    saveReply(reply, postId),
  ]);

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

    if (
      lastSnapshot &&
      lastSnapshot.authorId === reply.author.uid &&
      lastSnapshot.content === reply.content
    )
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
        authorId: reply.author.uid,
        content: reply.content,
        capturedAt: now,
        lastSeenAt: now,
      },
    });
  });
}

const savePost = async (post: Post) =>
  prisma.post.upsert({
    where: { id: post.id },
    create: {
      id: post.id,
      time: new Date(post.time * 1000),
      replyCount: post.replyCount,
    },
    update: {
      time: new Date(post.time * 1000),
      replyCount: post.replyCount,
    },
  });

export async function savePostSnapshot(post: PostDetails, now: Date | string) {
  await Promise.all([
    saveUserSnapshot(post.author, now),
    saveForum(post.forum),
    savePost(post),
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

export async function fetchPost(id: number, page: number) {
  const { status, data, time } = await (
    await client.get("discuss.show", { params: { id, page } })
  ).json();
  if (status !== 200) throw new Error();
  const now = new Date(time * 1000);
  await savePostSnapshot(data.post, now);
  await Promise.all(
    (data.replies.result as Reply[]).map((reply) =>
      saveReplySnapshot(reply, data.post.id, now),
    ),
  );
}
