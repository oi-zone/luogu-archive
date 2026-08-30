import "dotenv/config";

import { closeDb, db, sql } from "@luogu-discussion-archive/db";
import { closeQueues, queueRefreshJob } from "@luogu-discussion-archive/queue";

const apply = process.argv.slice(2).includes("--apply");
const entityTypes = ["article", "discussion", "paste"] as const;

try {
  const counts = await db.execute(sql`
    SELECT 'article' AS "entityType", count(*)::int AS "count" FROM "Article"
    UNION ALL
    SELECT 'discussion', count(*)::int FROM "Post"
    UNION ALL
    SELECT 'paste', count(*)::int FROM "Paste"
    ORDER BY 1
  `);

  const queued: { entityType: string; jobId: string | null }[] = [];
  if (apply) {
    for (const entityType of entityTypes) {
      const job = await queueRefreshJob({
        type: "visibilityScan",
        entityType,
      });
      queued.push({ entityType, jobId: job?.id ?? null });
    }
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        action: apply
          ? "bounded visibility scan jobs admitted"
          : "no jobs admitted; pass --apply to enqueue one bounded batch per entity type",
        entities: counts.rows,
        queued,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await Promise.all([closeQueues(), closeDb()]);
}
