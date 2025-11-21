import type { Article, ArticleDetails } from "@lgjs/types";

import { prisma, type ArticleCollection } from "@luogu-discussion-archive/db";
import { db, schema, sql } from "@luogu-discussion-archive/db/drizzle";

import { clientLentille } from "./client.js";
import { AccessError, HttpError } from "./error.js";
import { saveProblem } from "./problem.js";
import { saveUserSnapshots } from "./user.js";

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

async function saveArticle(article: Article, now: Date) {
  await saveUserSnapshots([article.author], now);

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

const saveArticleMeta = (article: Article, now: Date) =>
  Promise.all([
    saveArticle(article, now),
    article.solutionFor
      ? saveProblem(article.solutionFor, now)
      : Promise.resolve(),
    article.collection ? saveCollection(article.collection) : Promise.resolve(),
  ]);

async function saveArticleSnapshot(article: ArticleDetails, now: Date) {
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
  const res = await clientLentille.get("article.show", { params: { lid } });
  const { status, data, time } = await res.json().catch((err: unknown) => {
    throw res.ok ? err : new HttpError(res.url, res.status);
  });
  if (status === 403 || status === 404) throw new AccessError(res.url, status);
  if (status !== 200) throw new HttpError(res.url, status);

  const now = new Date(time * 1000);
  return saveArticleSnapshot(data.article, now);
}

export async function listArticles(
  collection: number | null = null,
  page?: number,
) {
  const res = await (collection
    ? clientLentille.get("article.collection", {
        params: { id: collection },
        ...(page ? { query: { page } } : {}),
      })
    : clientLentille.get("article.list", page ? { query: { page } } : {}));
  const { status, data, time } = await res.json().catch((err: unknown) => {
    throw res.ok ? err : new HttpError(res.url, res.status);
  });
  if (status === 403 || status === 404) throw new AccessError(res.url, status);
  if (status !== 200) throw new HttpError(res.url, status);

  const now = new Date(time * 1000);
  const articles = data.articles.result as Article[];
  return Promise.all(
    articles.map(async (article) =>
      saveArticleMeta(article, now).then(([{ lid }]) => lid),
    ),
  );
}

export async function fetchReplies(lid: string, after?: number) {
  // Here we don't have the server time, so just use local time
  const now = new Date();

  const res = await clientLentille.get("article.replies", {
    params: { lid },
    query: { sort: "time-d", ...(after ? { after } : {}) },
  });
  if (res.status === 403 || res.status === 404)
    throw new AccessError(res.url, res.status);
  if (!res.ok) throw new HttpError(res.url, res.status);
  const { replySlice } = await res.json();

  const lastReplyId = replySlice[replySlice.length - 1]?.id;
  if (!lastReplyId) return { lastReplyId: null, lastReplySaved: null };

  const lastReplySaved = await prisma.articleReply.findUnique({
    select: { updatedAt: true },
    where: { id: lastReplyId },
  });

  await saveUserSnapshots(
    replySlice.map((reply) => reply.author),
    now,
  );
  await db
    .insert(schema.ArticleReply)
    .values(
      replySlice.map((reply) => ({
        id: reply.id,
        articleId: lid,
        authorId: reply.author.uid,
        time: new Date(reply.time * 1000),
        content: reply.content,
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: [schema.ArticleReply.id],
      set: {
        articleId: sql.raw(`excluded."${schema.ArticleReply.articleId.name}"`),
        authorId: sql.raw(`excluded."${schema.ArticleReply.authorId.name}"`),
        time: sql.raw(`excluded."${schema.ArticleReply.time.name}"`),
        content: sql.raw(`excluded."${schema.ArticleReply.content.name}"`),
        updatedAt: sql.raw(`excluded."${schema.ArticleReply.updatedAt.name}"`),
      },
    });

  return { lastReplyId, lastReplySaved };
}
