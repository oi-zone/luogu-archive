import type { Forum, PostDetails, Reply } from "@lgjs/types";

import { prisma } from "@luogu-discussion-archive/db";

import { client } from "./client.js";
import { saveUser } from "./user.js";

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

export async function saveReply(
  reply: Reply,
  postId: number,
  now: Date | string,
) {
  await saveUser(reply.author, now);
  return prisma.$transaction(async (tx) => {
    const lastSnapshot = await tx.replySnapshot.findFirst({
      where: {
        replyId: reply.id,
      },
      orderBy: {
        time: "desc",
      },
    });
    if (
      lastSnapshot &&
      lastSnapshot.authorId === reply.author.uid &&
      lastSnapshot.content === reply.content
    )
      return tx.replySnapshot.update({
        where: {
          replyId_time: { replyId: reply.id, time: lastSnapshot.time },
        },
        data: { until: now },
      });
    return tx.replySnapshot.create({
      data: {
        reply: {
          connectOrCreate: {
            where: { id: reply.id },
            create: {
              id: reply.id,
              time: new Date(reply.time * 1000),
              post: { connect: { id: postId } },
            },
          },
        },
        author: { connect: { id: reply.author.uid } },
        content: reply.content,
        time: now,
        until: now,
      },
    });
  });
}

export async function savePost(post: PostDetails, now: Date | string) {
  await Promise.all([saveUser(post.author, now), saveForum(post.forum)]);
  return prisma.$transaction(async (tx) => {
    const lastSnapshot = await tx.postSnapshot.findFirst({
      where: {
        postId: post.id,
      },
      orderBy: {
        time: "desc",
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
        where: { postId_time: { postId: post.id, time: lastSnapshot.time } },
        data: { until: now },
      });
    return tx.postSnapshot.create({
      data: {
        post: {
          connectOrCreate: {
            where: { id: post.id },
            create: {
              id: post.id,
              time: new Date(post.time * 1000),
              replyCount: post.replyCount,
            },
          },
        },
        title: post.title,
        author: { connect: { id: post.author.uid } },
        forum: { connect: { slug: post.forum.slug } },
        content: post.content,
        time: now,
        until: now,
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
  await savePost(data.post, now);
  await Promise.all(
    (data.replies.result as Reply[]).map((reply) =>
      saveReply(reply, data.post.id, now),
    ),
  );
}
