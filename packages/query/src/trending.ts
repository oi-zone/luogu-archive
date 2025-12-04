import { desc, eq, gt, sql, sum } from "drizzle-orm";
import { unionAll, type PgColumn } from "drizzle-orm/pg-core";

import { db, schema } from "@luogu-discussion-archive/db";

const DEFAULT_LIMIT = 30;

const GRAVITY = 1.8;

/** @see https://www.righto.com/2009/06/how-does-newsyc-ranking-work.html */
const calculateRankSql = (
  table: typeof schema.Post | typeof schema.Article,
  score = sql<number>`${table.replyCount}`,
) =>
  sql`
    power(${score}, .8) / power(
      (extract(epoch from age(now(), ${table.time})) / 3600) + 2, 
      ${GRAVITY}
    )
  `
    .mapWith(Number)
    .as("rank");

export const getHotEntries = async (limit = DEFAULT_LIMIT) =>
  unionAll(
    db
      .select({
        type: sql<"discuss" | "article">`'discuss'`,
        id: sql<string>`cast(${schema.Post.id} as text)`,
        rank: calculateRankSql(schema.Post),
      })
      .from(schema.Post),

    db
      .select({
        type: sql<"discuss" | "article">`'article'`,
        id: schema.Article.lid,
        rank: calculateRankSql(
          schema.Article,
          sql`${schema.Article.upvote} + ${schema.Article.replyCount} + ${schema.Article.favorCount}`,
        ),
      })
      .from(schema.Article),
  )
    .orderBy(({ rank }) => desc(rank))
    .limit(limit);

const calculateActivityScoreSql = (column: PgColumn, days = 3) =>
  sum(
    sql`1 / (1 + exp(extract(epoch from age(now(), ${column})) / 86400 - ${days}))`,
  )
    .mapWith(Number)
    .as("score");

export const getActiveEntries = async (limit = DEFAULT_LIMIT) =>
  unionAll(
    db
      .select({
        type: sql<"discuss" | "article">`'discuss'`,
        id: sql<string>`cast(${schema.Reply.postId} as text)`,
        score: calculateActivityScoreSql(schema.Reply.time),
      })
      .from(schema.Reply)
      .where(gt(schema.Reply.time, sql`now() - interval '15 days'`))
      .groupBy(schema.Reply.postId),

    db
      .select({
        type: sql<"discuss" | "article">`'article'`,
        id: schema.ArticleReply.articleId,
        score: calculateActivityScoreSql(schema.ArticleReply.time),
      })
      .from(schema.ArticleReply)
      .where(gt(schema.ArticleReply.time, sql`now() - interval '15 days'`))
      .groupBy(schema.ArticleReply.articleId),
  )
    .orderBy(({ score }) => desc(score))
    .limit(limit);

export async function getActiveUsers(limit = DEFAULT_LIMIT) {
  const allActivities = unionAll(
    db
      .selectDistinctOn([schema.Post.id], {
        authorId: sql<number>`${db
          .select({ authorId: schema.PostSnapshot.authorId })
          .from(schema.PostSnapshot)
          .where(eq(schema.PostSnapshot.postId, schema.Post.id))
          .orderBy(desc(schema.PostSnapshot.capturedAt))
          .limit(1)}`.as("author_id"),
        time: schema.Post.time,
      })
      .from(schema.Post)
      .where(gt(schema.Post.time, sql`now() - interval '20 days'`)),
    db
      .select({
        authorId: schema.Reply.authorId,
        time: schema.Reply.time,
      })
      .from(schema.Reply)
      .where(gt(schema.Reply.time, sql`now() - interval '20 days'`)),
    db
      .select({
        authorId: schema.Article.authorId,
        time: schema.Article.time,
      })
      .from(schema.Article)
      .where(gt(schema.Article.time, sql`now() - interval '20 days'`)),
    db
      .select({
        authorId: schema.ArticleReply.authorId,
        time: schema.ArticleReply.time,
      })
      .from(schema.ArticleReply)
      .where(gt(schema.ArticleReply.time, sql`now() - interval '20 days'`)),
  ).as("all_activities");

  return db
    .select({
      type: sql<"user">`'user'`,
      id: allActivities.authorId,
      score: calculateActivityScoreSql(allActivities.time, 7),
    })
    .from(allActivities)
    .groupBy(allActivities.authorId)
    .orderBy(({ score }) => desc(score))
    .limit(limit);
}
