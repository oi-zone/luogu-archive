import type { Article, ArticleDetails, Comment } from "@lgjs/types";

import { prisma, type ArticleCollection } from "@luogu-discussion-archive/db";

import { clientLentille } from "./client.js";
import { AccessError } from "./error.js";
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

async function saveArticle(article: Article, now: Date | string) {
  await saveUserSnapshot(article.author, now);

  return prisma.article.upsert({
    where: { lid: article.lid },
    create: {
      lid: article.lid,
      time: new Date(article.time * 1000),
      authorId: article.author.uid,
      upvote: article.upvote,
      replyCount: article.replyCount,
      favorCount: article.favorCount,
      updatedAt: now,
    },
    update: {
      time: new Date(article.time * 1000),
      authorId: article.author.uid,
      upvote: article.upvote,
      replyCount: article.replyCount,
      favorCount: article.favorCount,
      updatedAt: now,
    },
  });
}

const saveArticleMeta = (article: Article, now: Date | string) =>
  Promise.all([
    saveArticle(article, now),
    article.solutionFor
      ? saveProblem(article.solutionFor, now)
      : Promise.resolve(),
    article.collection ? saveCollection(article.collection) : Promise.resolve(),
  ]);

async function saveArticleSnapshot(
  article: ArticleDetails,
  now: Date | string,
) {
  await saveArticleMeta(article, now);

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
      lastSnapshot.content === article.content &&
      lastSnapshot.adminNote === article.adminNote
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
        status: article.status,
        solutionForPid: article.solutionFor?.pid ?? null,
        promoteStatus: article.promoteStatus,
        collectionId: article.collection?.id ?? null,
        content: article.content,
        adminNote: article.adminNote,
        capturedAt: now,
        lastSeenAt: now,
      },
    });
  });
}

export async function fetchArticle(lid: string) {
  const { status, data, time } = await (
    await clientLentille.get("article.show", { params: { lid } })
  ).json();
  if (status !== 200) throw new AccessError("Failed to fetch article", status);
  const now = new Date(time * 1000);

  return saveArticleSnapshot(data.article, now);
}

export async function listArticles(
  collection: number | null = null,
  page?: number,
) {
  const { status, data, time } = await (
    await (collection
      ? clientLentille.get("article.collection", {
          params: { id: collection },
          ...(page ? { query: { page } } : {}),
        })
      : clientLentille.get("article.list", page ? { query: { page } } : {}))
  ).json();
  if (status !== 200) throw new AccessError("Failed to list articles", status);

  const now = new Date(time * 1000);
  const articles = data.articles.result as Article[];
  return Promise.all(
    articles.map(async (article) =>
      saveArticleMeta(article, now).then(([{ lid }]) => lid),
    ),
  );
}

async function saveReply(lid: string, reply: Comment, now: Date | string) {
  await saveUserSnapshot(reply.author, now);

  return prisma.articleReply.upsert({
    where: { id: reply.id },
    create: {
      id: reply.id,
      articleId: lid,
      authorId: reply.author.uid,
      time: new Date(reply.time * 1000),
      content: reply.content,
      updatedAt: now,
    },
    update: {
      articleId: lid,
      authorId: reply.author.uid,
      time: new Date(reply.time * 1000),
      content: reply.content,
      updatedAt: now,
    },
  });
}

export async function fetchReplies(lid: string, after?: number) {
  // Here we don't have the server time, so just use local time
  const now = new Date();

  const response = await (
    await clientLentille.get("article.replies", {
      params: { lid },
      query: { sort: "time-d", ...(after ? { after } : {}) },
    })
  ).json();
  if (!Object.hasOwn(response, "replySlice"))
    throw new Error(JSON.stringify(response));
  const { replySlice } = response;

  const lastReplyId = replySlice[replySlice.length - 1]?.id;
  if (!lastReplyId) return { lastReplyId: null, lastReplySaved: null };

  const lastReplySaved = await prisma.articleReply.findUnique({
    select: { updatedAt: true },
    where: { id: lastReplyId },
  });

  await Promise.all(replySlice.map((reply) => saveReply(lid, reply, now)));

  return { lastReplyId, lastReplySaved };
}
