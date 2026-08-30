import "dotenv/config";

import { Queue, type Job } from "bullmq";

import { closeDb, db, sql } from "@luogu-discussion-archive/db";
import {
  backfillQueue,
  closeQueues,
  getQueueCounts,
  LEGACY_QUEUE_NAME,
  redisConnection,
  refreshQueue,
} from "@luogu-discussion-archive/queue";

const args = new Set(process.argv.slice(2));
const repair = args.has("--repair");
const apply = repair && args.has("--apply");
const BATCH_SIZE = 500;
const REMOVE_CONCURRENCY = 50;
const ONE_HOUR_MS = 60 * 60 * 1000;

const legacyQueue = new Queue(LEGACY_QUEUE_NAME, {
  connection: redisConnection(),
});

function isLegacyBackfill(job: Job) {
  if (job.repeatJobKey || job.opts.repeat) return false;
  const data = job.data as Record<string, unknown>;
  const priority = job.opts.priority ?? 0;
  const legacyDedup = job.deduplicationId?.endsWith(":backfill") ?? false;
  if (priority !== 2 && !legacyDedup) return false;
  return (
    (data.type === "discuss" && typeof data.page === "number") ||
    (data.type === "articleReplies" && typeof data.after === "number")
  );
}

async function oldestTimestamp(queue: Queue) {
  const [waiting, prioritized] = await Promise.all([
    queue.getJobs("wait", 0, 0, true),
    queue.getJobs("prioritized", 0, 0, true),
  ]);
  const timestamps = [...waiting, ...prioritized].map((job) => job.timestamp);
  return timestamps.length ? Math.min(...timestamps) : null;
}

async function scanLegacyBackfills() {
  let offset = 0;
  let matched = 0;
  let olderThanOneHour = 0;
  let oldest: number | null = null;
  let removed = 0;

  for (;;) {
    const jobs = await legacyQueue.getJobs(
      ["wait", "prioritized"],
      offset,
      offset + BATCH_SIZE - 1,
      true,
    );
    if (jobs.length === 0) break;

    const legacy = jobs.filter(isLegacyBackfill);
    for (const job of legacy) {
      matched += 1;
      oldest =
        oldest === null ? job.timestamp : Math.min(oldest, job.timestamp);
      if (Date.now() - job.timestamp > ONE_HOUR_MS) olderThanOneHour += 1;
    }

    if (apply) {
      for (let index = 0; index < legacy.length; index += REMOVE_CONCURRENCY) {
        const batch = legacy.slice(index, index + REMOVE_CONCURRENCY);
        await Promise.all(batch.map((job) => job.remove()));
        removed += batch.length;
      }
    }

    offset += jobs.length - (apply ? legacy.length : 0);
    if (jobs.length < BATCH_SIZE && !apply) break;
  }

  return { matched, olderThanOneHour, oldest, removed };
}

function parseRedisMemory(info: string) {
  const allowed = new Set([
    "used_memory",
    "used_memory_human",
    "used_memory_rss",
    "used_memory_rss_human",
    "maxmemory",
    "maxmemory_human",
    "maxmemory_policy",
    "mem_fragmentation_ratio",
  ]);
  return Object.fromEntries(
    info
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.split(":", 2) as [string, string])
      .filter(([key]) => allowed.has(key)),
  );
}

try {
  const [
    refreshCounts,
    backfillCounts,
    legacyCounts,
    refreshOldest,
    backfillOldest,
    legacyOldest,
    refreshSchedulers,
    legacySchedulers,
    cursorSummary,
    cursorSamples,
    redisInfo,
  ] = await Promise.all([
    getQueueCounts(refreshQueue),
    getQueueCounts(backfillQueue),
    getQueueCounts(legacyQueue),
    oldestTimestamp(refreshQueue),
    oldestTimestamp(backfillQueue),
    oldestTimestamp(legacyQueue),
    refreshQueue.getJobSchedulers(0, 100, true),
    legacyQueue.getJobSchedulers(0, 100, true),
    db.execute<{
      status: string;
      entityType: string;
      count: number;
      oldestUpdatedAt: Date;
    }>(sql`
      SELECT
        "status",
        "entityType",
        count(*)::int AS "count",
        min("updatedAt") AS "oldestUpdatedAt"
      FROM "CrawlCursor"
      GROUP BY "status", "entityType"
      ORDER BY "status", "entityType"
    `),
    db.execute<{
      entityType: string;
      entityId: string;
      direction: string;
      nextCursor: string | null;
      status: string;
      pagesProcessed: number;
      updatedAt: Date;
    }>(sql`
      SELECT
        "entityType",
        "entityId",
        "direction",
        "nextCursor",
        "status",
        "pagesProcessed",
        "updatedAt"
      FROM "CrawlCursor"
      WHERE "status" IN ('pending', 'active', 'paused')
      ORDER BY "updatedAt" ASC
      LIMIT 100
    `),
    refreshQueue.client.then((client) => client.info("memory")),
  ]);

  const legacy = await scanLegacyBackfills();
  const now = Date.now();
  const age = (timestamp: number | null) =>
    timestamp === null ? null : Math.max(0, now - timestamp);

  process.stdout.write(
    `${JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        repairRequested: repair,
        queues: {
          refresh: {
            counts: refreshCounts,
            oldestWaitingAgeMs: age(refreshOldest),
          },
          backfill: {
            counts: backfillCounts,
            oldestWaitingAgeMs: age(backfillOldest),
          },
          legacy: {
            counts: legacyCounts,
            oldestWaitingAgeMs: age(legacyOldest),
          },
        },
        legacyBackfill: {
          matched: legacy.matched,
          olderThanOneHour: legacy.olderThanOneHour,
          oldestAgeMs: age(legacy.oldest),
          removed: legacy.removed,
        },
        schedulers: {
          refresh: refreshSchedulers.map((scheduler) => ({
            id: scheduler.key,
            next: scheduler.next,
            pattern: scheduler.pattern,
          })),
          legacy: legacySchedulers.map((scheduler) => ({
            id: scheduler.key,
            next: scheduler.next,
            pattern: scheduler.pattern,
          })),
        },
        cursors: {
          summary: cursorSummary.rows,
          oldestIncompleteSamples: cursorSamples.rows,
        },
        redisMemory: parseRedisMemory(redisInfo),
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await Promise.all([legacyQueue.close(), closeQueues(), closeDb()]);
}
