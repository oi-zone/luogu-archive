import "dotenv/config";

import { closeDb, db, sql } from "@luogu-discussion-archive/db";

function boundedInteger(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isSafeInteger(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

const ttlMs = boundedInteger(
  "VISIBILITY_TTL_MS",
  7 * 24 * 60 * 60 * 1000,
  60 * 60 * 1000,
  90 * 24 * 60 * 60 * 1000,
);
const cutoff = new Date(Date.now() - ttlMs);

try {
  const [entities, bodies, takedowns, scans] = await Promise.all([
    db.execute(sql`
      SELECT 'article' AS "entityType", "visibilityState" AS "state",
        count(*)::int AS "count",
        count(*) FILTER (WHERE "visibilityCheckedAt" IS NULL OR "visibilityCheckedAt" < ${cutoff})::int AS "stale"
      FROM "Article" GROUP BY "visibilityState"
      UNION ALL
      SELECT 'discussion', "visibilityState", count(*)::int,
        count(*) FILTER (WHERE "visibilityCheckedAt" IS NULL OR "visibilityCheckedAt" < ${cutoff})::int
      FROM "Post" GROUP BY "visibilityState"
      UNION ALL
      SELECT 'paste', "visibilityState", count(*)::int,
        count(*) FILTER (WHERE "visibilityCheckedAt" IS NULL OR "visibilityCheckedAt" < ${cutoff})::int
      FROM "Paste" GROUP BY "visibilityState"
      ORDER BY 1, 2
    `),
    db.execute(sql`
      SELECT 'articleSnapshot' AS "bodyType", "exposureState" AS "state",
        count(*)::int AS "count", COALESCE(sum(octet_length("content")), 0)::bigint AS "bytes"
      FROM "ArticleSnapshot" GROUP BY "exposureState"
      UNION ALL
      SELECT 'postSnapshot', "exposureState", count(*)::int,
        COALESCE(sum(octet_length("content")), 0)::bigint
      FROM "PostSnapshot" GROUP BY "exposureState"
      UNION ALL
      SELECT 'replySnapshot', "exposureState", count(*)::int,
        COALESCE(sum(octet_length("content")), 0)::bigint
      FROM "ReplySnapshot" GROUP BY "exposureState"
      UNION ALL
      SELECT 'articleReply', "exposureState", count(*)::int,
        COALESCE(sum(octet_length("content")), 0)::bigint
      FROM "ArticleReply" GROUP BY "exposureState"
      UNION ALL
      SELECT 'pasteSnapshot', "exposureState", count(*)::int,
        COALESCE(sum(octet_length("data")), 0)::bigint
      FROM "PasteSnapshot" GROUP BY "exposureState"
      ORDER BY 1, 2
    `),
    db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM "PostTakedown") AS "postTakedowns",
        (SELECT count(*)::int FROM "ReplyTakedown") AS "replyTakedowns",
        (SELECT count(*)::int
          FROM "Post" p JOIN "PostTakedown" pt ON pt."postId" = p."id"
          WHERE p."public" = TRUE) AS "takedownPostsWithLegacyPublicFlag",
        (SELECT count(*)::int
          FROM "Reply" r JOIN "ReplyTakedown" rt ON rt."replyId" = r."id") AS "takedownReplies"
    `),
    db.execute(sql`
      SELECT "entityType", "afterId", "cycle", "lastCompletedAt", "updatedAt"
      FROM "VisibilityScanState"
      ORDER BY "entityType"
    `),
  ]);

  process.stdout.write(
    `${JSON.stringify(
      {
        mode: "dry-run",
        cutoff: cutoff.toISOString(),
        entities: entities.rows,
        storedBodies: bodies.rows,
        takedowns: takedowns.rows[0] ?? {},
        scanProgress: scans.rows,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await closeDb();
}
