import "dotenv/config";

import { closeDb, db, sql } from "@luogu-discussion-archive/db";

const apply = process.argv.slice(2).includes("--apply");
const BATCH_SIZE = 500;

type BodyType =
  | "pasteSnapshot"
  | "articleSnapshot"
  | "postSnapshot"
  | "replySnapshot"
  | "articleReply";

interface SummaryRow extends Record<string, unknown> {
  bodyType: BodyType;
  records: number;
  bytes: string;
}

async function audit() {
  return (
    await db.execute<SummaryRow>(sql`
      SELECT 'pasteSnapshot' AS "bodyType", count(*)::int AS "records",
        COALESCE(sum(octet_length(ps."data")), 0)::bigint AS "bytes"
      FROM "PasteSnapshot" ps
      JOIN "Paste" p ON p."id" = ps."pasteId"
      WHERE ps."data" IS NOT NULL
        AND (
          p."visibilityState" <> 'public'
          OR ps."public" = FALSE
          OR ps."exposureState" <> 'public'
          OR ps."verifiedSource" IS DISTINCT FROM 'anonymous_upstream'
          OR ps."verifiedPublicAt" IS NULL
        )
      UNION ALL
      SELECT 'articleSnapshot', count(*)::int,
        COALESCE(sum(octet_length(s."content")), 0)::bigint
      FROM "ArticleSnapshot" s
      JOIN "Article" a ON a."lid" = s."articleId"
      WHERE s."content" <> '' AND (
        a."visibilityState" <> 'public'
        OR s."exposureState" <> 'public'
        OR s."verifiedSource" IS DISTINCT FROM 'anonymous_upstream'
        OR s."verifiedPublicAt" IS NULL
      )
      UNION ALL
      SELECT 'postSnapshot', count(*)::int,
        COALESCE(sum(octet_length(s."content")), 0)::bigint
      FROM "PostSnapshot" s
      JOIN "Post" p ON p."id" = s."postId"
      LEFT JOIN "PostTakedown" pt ON pt."postId" = p."id"
      WHERE s."content" <> '' AND (
        p."visibilityState" <> 'public'
        OR pt."postId" IS NOT NULL
        OR s."exposureState" <> 'public'
        OR s."verifiedSource" IS DISTINCT FROM 'anonymous_upstream'
        OR s."verifiedPublicAt" IS NULL
      )
      UNION ALL
      SELECT 'replySnapshot', count(*)::int,
        COALESCE(sum(octet_length(s."content")), 0)::bigint
      FROM "ReplySnapshot" s
      JOIN "Reply" r ON r."id" = s."replyId"
      JOIN "Post" p ON p."id" = r."postId"
      LEFT JOIN "PostTakedown" pt ON pt."postId" = p."id"
      LEFT JOIN "ReplyTakedown" rt ON rt."replyId" = r."id"
      WHERE s."content" <> '' AND (
        p."visibilityState" <> 'public'
        OR pt."postId" IS NOT NULL
        OR rt."replyId" IS NOT NULL
        OR s."exposureState" <> 'public'
        OR s."verifiedSource" IS DISTINCT FROM 'anonymous_upstream'
        OR s."verifiedPublicAt" IS NULL
      )
      UNION ALL
      SELECT 'articleReply', count(*)::int,
        COALESCE(sum(octet_length(r."content")), 0)::bigint
      FROM "ArticleReply" r
      JOIN "Article" a ON a."lid" = r."articleId"
      WHERE r."content" <> '' AND (
        a."visibilityState" <> 'public'
        OR r."exposureState" <> 'public'
        OR r."verifiedSource" IS DISTINCT FROM 'anonymous_upstream'
        OR r."verifiedPublicAt" IS NULL
      )
      ORDER BY 1
    `)
  ).rows;
}

async function auditPolicyFlags() {
  return (
    await db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM "Article"
          WHERE "public" = TRUE AND (
            "visibilityState" <> 'public'
            OR "visibilitySource" IS DISTINCT FROM 'anonymous_upstream'
            OR "visibilityCheckedAt" IS NULL
          )) AS "restrictedArticlesWithLegacyPublicFlag",
        (SELECT count(*)::int FROM "Post"
          WHERE "public" = TRUE AND (
            "visibilityState" <> 'public'
            OR "visibilitySource" IS DISTINCT FROM 'anonymous_upstream'
            OR "visibilityCheckedAt" IS NULL
          )) AS "restrictedPostsWithLegacyPublicFlag",
        (SELECT count(*)::int FROM "Paste"
          WHERE "public" = TRUE AND (
            "visibilityState" <> 'public'
            OR "visibilitySource" IS DISTINCT FROM 'anonymous_upstream'
            OR "visibilityCheckedAt" IS NULL
          )) AS "restrictedPastesWithLegacyPublicFlag",
        (SELECT count(*)::int FROM "Post" p
          JOIN "PostTakedown" pt ON pt."postId" = p."id"
          WHERE p."public" = TRUE) AS "takedownPostsWithLegacyPublicFlag",
        (SELECT count(*)::int FROM "Reply" r
          JOIN "ReplyTakedown" rt ON rt."replyId" = r."id") AS "takedownReplies"
    `)
  ).rows[0];
}

async function clearBatch(bodyType: BodyType) {
  switch (bodyType) {
    case "pasteSnapshot":
      return db.execute(sql`
        WITH targets AS (
          SELECT ps.ctid
          FROM "PasteSnapshot" ps
          JOIN "Paste" p ON p."id" = ps."pasteId"
          WHERE ps."data" IS NOT NULL AND (
            p."visibilityState" <> 'public'
            OR ps."public" = FALSE
            OR ps."exposureState" <> 'public'
            OR ps."verifiedSource" IS DISTINCT FROM 'anonymous_upstream'
            OR ps."verifiedPublicAt" IS NULL
          )
          LIMIT ${BATCH_SIZE}
        )
        UPDATE "PasteSnapshot" ps SET "data" = NULL
        FROM targets WHERE ps.ctid = targets.ctid
        RETURNING 1
      `);
    case "articleSnapshot":
      return db.execute(sql`
        WITH targets AS (
          SELECT s.ctid FROM "ArticleSnapshot" s
          JOIN "Article" a ON a."lid" = s."articleId"
          WHERE s."content" <> '' AND (
            a."visibilityState" <> 'public'
            OR s."exposureState" <> 'public'
            OR s."verifiedSource" IS DISTINCT FROM 'anonymous_upstream'
            OR s."verifiedPublicAt" IS NULL
          ) LIMIT ${BATCH_SIZE}
        )
        UPDATE "ArticleSnapshot" s SET "content" = ''
        FROM targets WHERE s.ctid = targets.ctid RETURNING 1
      `);
    case "postSnapshot":
      return db.execute(sql`
        WITH targets AS (
          SELECT s.ctid FROM "PostSnapshot" s
          JOIN "Post" p ON p."id" = s."postId"
          LEFT JOIN "PostTakedown" pt ON pt."postId" = p."id"
          WHERE s."content" <> '' AND (
            p."visibilityState" <> 'public' OR pt."postId" IS NOT NULL
            OR s."exposureState" <> 'public'
            OR s."verifiedSource" IS DISTINCT FROM 'anonymous_upstream'
            OR s."verifiedPublicAt" IS NULL
          ) LIMIT ${BATCH_SIZE}
        )
        UPDATE "PostSnapshot" s SET "content" = ''
        FROM targets WHERE s.ctid = targets.ctid RETURNING 1
      `);
    case "replySnapshot":
      return db.execute(sql`
        WITH targets AS (
          SELECT s.ctid FROM "ReplySnapshot" s
          JOIN "Reply" r ON r."id" = s."replyId"
          JOIN "Post" p ON p."id" = r."postId"
          LEFT JOIN "PostTakedown" pt ON pt."postId" = p."id"
          LEFT JOIN "ReplyTakedown" rt ON rt."replyId" = r."id"
          WHERE s."content" <> '' AND (
            p."visibilityState" <> 'public'
            OR pt."postId" IS NOT NULL OR rt."replyId" IS NOT NULL
            OR s."exposureState" <> 'public'
            OR s."verifiedSource" IS DISTINCT FROM 'anonymous_upstream'
            OR s."verifiedPublicAt" IS NULL
          ) LIMIT ${BATCH_SIZE}
        )
        UPDATE "ReplySnapshot" s SET "content" = ''
        FROM targets WHERE s.ctid = targets.ctid RETURNING 1
      `);
    case "articleReply":
      return db.execute(sql`
        WITH targets AS (
          SELECT r.ctid FROM "ArticleReply" r
          JOIN "Article" a ON a."lid" = r."articleId"
          WHERE r."content" <> '' AND (
            a."visibilityState" <> 'public'
            OR r."exposureState" <> 'public'
            OR r."verifiedSource" IS DISTINCT FROM 'anonymous_upstream'
            OR r."verifiedPublicAt" IS NULL
          ) LIMIT ${BATCH_SIZE}
        )
        UPDATE "ArticleReply" r SET "content" = ''
        FROM targets WHERE r.ctid = targets.ctid RETURNING 1
      `);
  }
}

try {
  const [before, policyFlags] = await Promise.all([
    audit(),
    auditPolicyFlags(),
  ]);
  const cleared: Partial<Record<BodyType, number>> = {};
  if (apply) {
    for (const row of before) {
      let total = 0;
      for (;;) {
        const result = await clearBatch(row.bodyType);
        total += result.rowCount ?? 0;
        if ((result.rowCount ?? 0) < BATCH_SIZE) break;
      }
      cleared[row.bodyType] = total;
    }
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        bodyFindings: before.map((row) => ({
          bodyType: row.bodyType,
          records: row.records,
          bytes: Number(row.bytes),
          cleared: cleared[row.bodyType] ?? 0,
        })),
        policyFlags,
        warning: apply
          ? "Body clearing completed; restore requires a database backup"
          : "No body was changed; back up PostgreSQL before --apply",
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await closeDb();
}
