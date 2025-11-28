import type {
  Article,
  ArticleCollectionSummary,
  ArticleDetails,
} from "@lgjs/types";

import {
  and,
  db,
  eq,
  isNull,
  max,
  schema,
  sql,
} from "@luogu-discussion-archive/db/drizzle";

import { clientLentille } from "./client.js";
import { AccessError, HttpError, UnexpectedStatusError } from "./error.js";
import { saveProblems } from "./problem.js";
import { saveUserSnapshots } from "./user.js";
import { deduplicate } from "./utils.js";

function saveCollections(collections: ArticleCollectionSummary[]) {
  const deduplicatedCollections = deduplicate(
    collections,
    (collection) => collection.id,
  );
  if (!deduplicatedCollections.length) return;

  return db
    .insert(schema.ArticleCollection)
    .values(
      deduplicatedCollections.map((collection) => ({
        id: collection.id,
        name: collection.name,
      })),
    )
    .onConflictDoUpdate({
      target: [schema.ArticleCollection.id],
      set: {
        name: sql.raw(`excluded."${schema.ArticleCollection.name.name}"`),
      },
    });
}

async function saveArticles(articles: Article[], now: Date) {
  const deduplicatedArticles = deduplicate(articles, (article) => article.lid);
  if (!deduplicatedArticles.length) return;

  await saveUserSnapshots(
    deduplicatedArticles.map((article) => article.author),
    now,
  );

  return db
    .insert(schema.Article)
    .values(
      deduplicatedArticles.map((article) => ({
        lid: article.lid,
        time: new Date(article.time * 1000),
        authorId: article.author.uid,
        upvote: article.upvote,
        replyCount: article.replyCount,
        favorCount: article.favorCount,
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: [schema.Article.lid],
      set: {
        time: sql.raw(`excluded."${schema.Article.time.name}"`),
        authorId: sql.raw(`excluded."${schema.Article.authorId.name}"`),
        upvote: sql.raw(`excluded."${schema.Article.upvote.name}"`),
        replyCount: sql.raw(`excluded."${schema.Article.replyCount.name}"`),
        favorCount: sql.raw(`excluded."${schema.Article.favorCount.name}"`),
        updatedAt: sql.raw(`excluded."${schema.Article.updatedAt.name}"`),
      },
    });
}

async function saveArticleSnapshot(article: ArticleDetails, now: Date) {
  await Promise.all([
    saveArticles([article], now),
    saveProblems(article.solutionFor ? [article.solutionFor] : [], now),
    saveCollections(article.collection ? [article.collection] : []),
  ]);

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(${parseInt(article.lid, 36)})`,
    );

    const lastCaptured = tx
      .select({ val: max(schema.ArticleSnapshot.capturedAt) })
      .from(schema.ArticleSnapshot)
      .where(eq(schema.ArticleSnapshot.articleId, article.lid));

    const { rowCount } = await tx
      .update(schema.ArticleSnapshot)
      .set({ lastSeenAt: now })
      .where(
        and(
          eq(schema.ArticleSnapshot.articleId, article.lid),
          eq(schema.ArticleSnapshot.capturedAt, lastCaptured),

          eq(schema.ArticleSnapshot.title, article.title),
          eq(schema.ArticleSnapshot.category, article.category),
          eq(schema.ArticleSnapshot.status, article.status),
          article.solutionFor !== null
            ? eq(schema.ArticleSnapshot.solutionForPid, article.solutionFor.pid)
            : isNull(schema.ArticleSnapshot.solutionForPid),
          eq(schema.ArticleSnapshot.promoteStatus, article.promoteStatus),
          article.collection !== null
            ? eq(schema.ArticleSnapshot.collectionId, article.collection.id)
            : isNull(schema.ArticleSnapshot.collectionId),
          eq(schema.ArticleSnapshot.content, article.content),
          article.adminNote !== null
            ? eq(schema.ArticleSnapshot.adminNote, article.adminNote)
            : isNull(schema.ArticleSnapshot.adminNote),
        ),
      );

    if (rowCount === 0)
      return tx.insert(schema.ArticleSnapshot).values({
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
      });
  });
}

export async function fetchArticle(lid: string) {
  const res = await clientLentille.get("article.show", { params: { lid } });
  const { status, data, time } = await res.json().catch((err: unknown) => {
    throw res.ok ? err : new HttpError(res);
  });
  if (status === 403 || status === 404) throw new AccessError(res.url, status);
  if (status !== 200)
    throw new UnexpectedStatusError("Unexpected status", res.url, status);

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
    throw res.ok ? err : new HttpError(res);
  });
  if (status === 403 || status === 404) throw new AccessError(res.url, status);
  if (status !== 200)
    throw new UnexpectedStatusError("Unexpected status", res.url, status);

  const now = new Date(time * 1000);
  const articles = data.articles.result as Article[];
  await Promise.all([
    saveArticles(articles, now),
    saveCollections(articles.flatMap((article) => article.collection ?? [])),
    saveUserSnapshots(
      articles.map((article) => article.author),
      now,
    ),
  ]);
  return articles.map((article) => article.lid);
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
  if (!res.ok) throw new HttpError(res);
  const { replySlice } = await res.json();

  const lastReplyId = replySlice[replySlice.length - 1]?.id;
  if (!lastReplyId) return { lastReplyId: null, lastReplySaved: null };

  const lastReplySaved = await db.query.ArticleReply.findFirst({
    columns: { updatedAt: true },
    where: eq(schema.ArticleReply.id, lastReplyId),
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
