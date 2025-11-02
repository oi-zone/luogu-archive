import type { ArticleDetails } from "@lgjs/types";

import { prisma, type ArticleCollection } from "@luogu-discussion-archive/db";

import { client } from "./client.js";
import { saveProblem } from "./problem.js";
import { saveUserSnapshot } from "./user.js";

const saveCollection = (collection: ArticleCollection) =>
  prisma.articleCollection.upsert({
    where: { id: collection.id },
    update: {
      name: collection.name,
    },
    create: {
      id: collection.id,
      name: collection.name,
    },
  });

async function saveArticle(article: ArticleDetails, now: Date | string) {
  await Promise.all([
    saveUserSnapshot(article.author, now),
    ...(article.solutionFor ? [saveProblem(article.solutionFor)] : []),
    ...(article.collection ? [saveCollection(article.collection)] : []),
  ]);

  return prisma.article.upsert({
    where: { lid: article.lid },
    create: {
      lid: article.lid,
      time: new Date(article.time * 1000),
      authorId: article.author.uid,
      upvote: article.upvote,
      replyCount: article.replyCount,
      favorCount: article.favorCount,
      status: article.status,
      solutionForPid: article.solutionFor?.pid ?? null,
      promoteStatus: article.promoteStatus,
      collectionId: article.collection?.id ?? null,
      adminNote: article.adminNote,
    },
    update: {
      time: new Date(article.time * 1000),
      authorId: article.author.uid,
      upvote: article.upvote,
      replyCount: article.replyCount,
      favorCount: article.favorCount,
      status: article.status,
      solutionForPid: article.solutionFor?.pid ?? null,
      promoteStatus: article.promoteStatus,
      collectionId: article.collection?.id ?? null,
      adminNote: article.adminNote,
    },
  });
}

async function saveArticleSnapshot(
  article: ArticleDetails,
  now: Date | string,
) {
  await saveArticle(article, now);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${parseInt(article.lid, 36)});`;

    const lastSnapshot = await tx.articleSnapshot.findFirst({
      where: { articleId: article.lid },
      orderBy: { capturedAt: "desc" },
    });

    if (
      lastSnapshot &&
      lastSnapshot.title === article.title &&
      lastSnapshot.category === article.category &&
      lastSnapshot.content === article.content
    )
      return tx.articleSnapshot.update({
        where: {
          articleId_capturedAt: {
            articleId: article.lid,
            capturedAt: lastSnapshot.capturedAt,
          },
        },
        data: { lastSeenAt: now },
      });

    return tx.articleSnapshot.create({
      data: {
        articleId: article.lid,
        title: article.title,
        category: article.category,
        content: article.content,
        capturedAt: now,
        lastSeenAt: now,
      },
    });
  });
}

export async function fetchArticle(lid: string) {
  const { status, data, time } = await (
    await client.get("article.show", { params: { lid } })
  ).json();
  if (status !== 200) throw new Error();
  const now = new Date(time * 1000);

  await saveArticleSnapshot(data.article, now);
}
