import "dotenv/config";

import { closeDb, db, sql } from "@luogu-discussion-archive/db";

const apply = process.argv.slice(2).includes("--apply");
const BATCH_SIZE = 500;

interface AuditRow extends Record<string, unknown> {
  pasteId: string;
  snapshotsWithBody: number;
  storedBytes: string;
}

async function findBatch(afterId: string | null) {
  return (
    await db.execute<AuditRow>(sql`
      SELECT
        ps."pasteId" AS "pasteId",
        count(*)::int AS "snapshotsWithBody",
        COALESCE(sum(octet_length(ps."data")), 0)::bigint AS "storedBytes"
      FROM "PasteSnapshot" ps
      JOIN "Paste" p ON p."id" = ps."pasteId"
      WHERE p."public" = FALSE
        AND ps."data" IS NOT NULL
        AND (${afterId}::text IS NULL OR ps."pasteId" > ${afterId})
      GROUP BY ps."pasteId"
      ORDER BY ps."pasteId"
      LIMIT ${BATCH_SIZE}
    `)
  ).rows;
}

let afterId: string | null = null;
let entities = 0;
let snapshots = 0;
let bytes = 0;

try {
  for (;;) {
    const rows = await findBatch(afterId);
    if (rows.length === 0) break;

    for (const row of rows) {
      entities += 1;
      snapshots += row.snapshotsWithBody;
      bytes += Number(row.storedBytes);
    }

    if (apply) {
      const pasteIds = rows.map((row) => row.pasteId);
      await db.execute(sql`
        UPDATE "PasteSnapshot"
        SET "data" = NULL
        WHERE "pasteId" = ANY(${pasteIds})
          AND "data" IS NOT NULL
      `);
    }

    afterId = rows.at(-1)?.pasteId ?? null;
    if (rows.length < BATCH_SIZE) break;
  }

  process.stdout.write(
    `${JSON.stringify({
      mode: apply ? "apply" : "dry-run",
      privateEntitiesWithStoredBody: entities,
      snapshotsWithStoredBody: snapshots,
      storedBodyBytes: bytes,
      bodiesCleared: apply ? snapshots : 0,
    })}\n`,
  );
} finally {
  await closeDb();
}
