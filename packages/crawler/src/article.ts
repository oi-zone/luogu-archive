import type {
  Article,
  ArticleCollectionSummary,
  ArticleDetails,
} from "@lgjs/types";

import {
  and,
  db,
  eq,
  inArray,
  isNull,
  max,
  schema,
  sql,
} from "@luogu-discussion-archive/db";

import { publicLentille } from "./client.js";
import { AccessError, HttpError, UnexpectedStatusError } from "./error.js";
import {
  expectArray,
  expectFiniteNumber,
  expectRecord,
  expectString,
} from "./http.js";
import { saveProblems } from "./problem.js";
import { saveUserSnapshots } from "./user.js";
import { deduplicate } from "./utils.js";

const MAX_ARTICLE_RESPONSE_BYTES = 8 * 1024 * 1024;
const MAX_ARTICLE_LIST_BYTES = 2 * 1024 * 1024;
const MAX_ARTICLE_REPLIES_BYTES = 4 * 1024 * 1024;
const MAX_ARTICLE_LIST_ITEMS = 100;
const MAX_ARTICLE_REPLIES = 100;

function validateArticleEnvelope(value: unknown) {
  const root = expectRecord(value, "article.show");
  const status = expectFiniteNumber(root.status, "article.show.status");
  if (status !== 200) {
    return { status, time: 0, data: null };
  }
  const data = expectRecord(root.data, "article.show");
  const article = expectRecord(
    data.article,
    "article.show",
  ) as unknown as ArticleDetails;
  const time = expectFiniteNumber(root.time, "article.show.time");
  expectString(article.lid, "article.show.article.lid", 8);
  return {
    status,
    time,
    data: { article },
  };
}

function validateArticleListEnvelope(value: unknown) {
  const root = expectRecord(value, "article.list");
  const data = expectRecord(root.data, "article.list");
  const container = expectRecord(data.articles, "article.list");
  const articles = expectArray<Article>(
    container.result,
    "article.list.articles",
    MAX_ARTICLE_LIST_ITEMS,
  );
  expectFiniteNumber(root.status, "article.list.status");
  expectFiniteNumber(root.time, "article.list.time");
  for (const article of articles)
    expectString(article.lid, "article.list.article.lid", 8);
  return {
    status: root.status as number,
    time: root.time as number,
    data: { articles: { result: articles } },
  };
}

function validateArticleReplies(value: unknown) {
  const root = expectRecord(value, "article.replies");
  return {
    replySlice: expectArray<
      Parameters<typeof saveUserSnapshots>[0][number] & {
        id: number;
        time: number;
        content: string;
        author: Parameters<typeof saveUserSnapshots>[0][number];
      }
    >(root.replySlice, "article.replies", MAX_ARTICLE_REPLIES),
  };
}

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
        public: article.status === 2,
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
        public: sql.raw(`excluded."${schema.Article.public.name}"`),
        updatedAt: sql.raw(`excluded."${schema.Article.updatedAt.name}"`),
      },
    });
}

async function saveArticleSnapshot(article: ArticleDetails, now: Date) {
  // Hidden/deleted article payloads are never persisted as new public
  // snapshots. The entity-level flag revokes every historical public path.
  if (article.status !== 2) {
    await saveArticles([article], now);
    return;
  }

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

async function restrictArticle(lid: string) {
  await db
    .update(schema.Article)
    .set({ public: false, updatedAt: new Date() })
    .where(eq(schema.Article.lid, lid));
}

export async function fetchArticle(lid: string) {
  let response: Awaited<
    ReturnType<
      typeof publicLentille.getJson<ReturnType<typeof validateArticleEnvelope>>
    >
  >;
  try {
    response = await publicLentille.getJson(
      "article.show",
      { params: { lid } },
      {
        endpoint: "article.show",
        timeoutMs: 30_000,
        maxBytes: MAX_ARTICLE_RESPONSE_BYTES,
        validate: validateArticleEnvelope,
      },
    );
  } catch (error) {
    if (
      error instanceof HttpError &&
      (error.status === 403 || error.status === 404)
    ) {
      await restrictArticle(lid);
      throw new AccessError(error.url, error.status);
    }
    throw error;
  }
  const { data: envelope, url } = response;
  const { status, data, time } = envelope;
  if (status === 403 || status === 404) {
    await restrictArticle(lid);
    throw new AccessError(url, status);
  }
  if (status !== 200)
    throw new UnexpectedStatusError("Unexpected status", url, status);
  if (!data)
    throw new UnexpectedStatusError("Missing article data", url, status);

  const now = new Date(time * 1000);
  return saveArticleSnapshot(data.article, now);
}

export async function listArticles(
  collection: number | null = null,
  page?: number,
) {
  const request = collection
    ? publicLentille.getJson(
        "article.collection",
        {
          params: { id: collection },
          ...(page ? { query: { page } } : {}),
        },
        {
          endpoint: "article.collection",
          timeoutMs: 20_000,
          maxBytes: MAX_ARTICLE_LIST_BYTES,
          validate: validateArticleListEnvelope,
        },
      )
    : publicLentille.getJson("article.list", page ? { query: { page } } : {}, {
        endpoint: "article.list",
        timeoutMs: 20_000,
        maxBytes: MAX_ARTICLE_LIST_BYTES,
        validate: validateArticleListEnvelope,
      });
  const { data: envelope, url } = await request;
  const { status, data, time } = envelope;
  if (status === 403 || status === 404) throw new AccessError(url, status);
  if (status !== 200)
    throw new UnexpectedStatusError("Unexpected status", url, status);

  const now = new Date(time * 1000);
  const articles = data.articles.result;
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

  let response: Awaited<
    ReturnType<
      typeof publicLentille.getJson<ReturnType<typeof validateArticleReplies>>
    >
  >;
  try {
    response = await publicLentille.getJson(
      "article.replies",
      {
        params: { lid },
        query: { sort: "time-d", ...(after ? { after } : {}) },
      },
      {
        endpoint: "article.replies",
        timeoutMs: 20_000,
        maxBytes: MAX_ARTICLE_REPLIES_BYTES,
        validate: validateArticleReplies,
      },
    );
  } catch (error) {
    if (
      error instanceof HttpError &&
      (error.status === 403 || error.status === 404)
    ) {
      await restrictArticle(lid);
      throw new AccessError(error.url, error.status);
    }
    throw error;
  }
  const { data, url } = response;
  void url;
  const { replySlice } = data;

  const lastReplyId = replySlice[replySlice.length - 1]?.id;
  if (!lastReplyId)
    return {
      lastReplyId: null,
      lastReplySaved: null,
      replyCount: 0,
      newReplyCount: 0,
    };

  const existingReplies = await db
    .select({ id: schema.ArticleReply.id })
    .from(schema.ArticleReply)
    .where(
      inArray(
        schema.ArticleReply.id,
        replySlice.map((reply) => reply.id),
      ),
    );
  const existingIds = new Set(existingReplies.map(({ id }) => id));

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

  return {
    lastReplyId,
    lastReplySaved,
    replyCount: replySlice.length,
    newReplyCount: replySlice.filter((reply) => !existingIds.has(reply.id))
      .length,
  };
}
