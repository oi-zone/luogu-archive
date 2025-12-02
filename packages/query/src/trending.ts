import { desc, sql } from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";

import { db, schema } from "@luogu-discussion-archive/db/drizzle";

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

const postsQuery = db
  .select({
    type: sql<string>`'post'`,
    id: sql<string>`cast(${schema.Post.id} as text)`,
    rank: calculateRankSql(schema.Post),
  })
  .from(schema.Post);

const articlesQuery = db
  .select({
    type: sql<string>`'article'`,
    id: schema.Article.lid,
    rank: calculateRankSql(
      schema.Article,
      sql`${schema.Article.upvote} + ${schema.Article.replyCount} + ${schema.Article.favorCount}`,
    ),
  })
  .from(schema.Article);

export const getTrendingEntries = async (limit = 30) =>
  unionAll(postsQuery, articlesQuery)
    .orderBy(desc(sql`rank`))
    .limit(limit);
