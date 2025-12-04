import { desc, eq, gt, sql, sum } from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";

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
    .orderBy(desc(sql`rank`))
    .limit(limit);

const calculateRepliesScoreSql = (
  table: typeof schema.Reply | typeof schema.ArticleReply,
  days = 3,
) =>
  sum(
    sql`1 / (1 + exp(extract(epoch from age(now(), ${table.time})) / 86400 - ${days}))`,
  )
    .mapWith(Number)
    .as("score");

export const getActiveEntries = async (limit = DEFAULT_LIMIT) =>
  unionAll(
    db
      .select({
        type: sql<"discuss" | "article">`'discuss'`,
        id: sql<string>`cast(${schema.Post.id} as text)`,
        score: calculateRepliesScoreSql(schema.Reply),
      })
      .from(schema.Post)
      .innerJoin(schema.Reply, eq(schema.Post.id, schema.Reply.postId))
      .where(gt(schema.Reply.time, sql`now() - interval '15 days'`))
      .groupBy(schema.Post.id),

    db
      .select({
        type: sql<"discuss" | "article">`'article'`,
        id: schema.Article.lid,
        score: calculateRepliesScoreSql(schema.ArticleReply),
      })
      .from(schema.Article)
      .innerJoin(
        schema.ArticleReply,
        eq(schema.Article.lid, schema.ArticleReply.articleId),
      )
      .where(gt(schema.ArticleReply.time, sql`now() - interval '15 days'`))
      .groupBy(schema.Article.lid),
  )
    .orderBy(desc(sql`score`))
    .limit(limit);
