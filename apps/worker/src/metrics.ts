import { pool } from "@luogu-discussion-archive/db";
import logger from "@luogu-discussion-archive/logging";
import {
  backfillQueue,
  boundedInteger,
  getQueueCounts,
  refreshQueue,
} from "@luogu-discussion-archive/queue";

import { rateLimitUntil, takeJobCounters } from "./worker.js";

async function oldestWaitingAgeMs(
  queue: typeof refreshQueue | typeof backfillQueue,
) {
  const [waiting, prioritized] = await Promise.all([
    queue.getJobs("wait", 0, 0, true),
    queue.getJobs("prioritized", 0, 0, true),
  ]);
  const timestamps = [...waiting, ...prioritized].map((job) => job.timestamp);
  return timestamps.length
    ? Math.max(0, Date.now() - Math.min(...timestamps))
    : null;
}

export function startMetrics() {
  const intervalMs = boundedInteger(
    "WORKER_METRICS_INTERVAL_MS",
    60_000,
    10_000,
    3_600_000,
  );

  let collecting = false;
  const collect = async () => {
    if (collecting) return;
    collecting = true;
    try {
      const [refreshCounts, backfillCounts, refreshOldest, backfillOldest] =
        await Promise.all([
          getQueueCounts(refreshQueue),
          getQueueCounts(backfillQueue),
          oldestWaitingAgeMs(refreshQueue),
          oldestWaitingAgeMs(backfillQueue),
        ]);
      const memory = process.memoryUsage();
      const now = Date.now();
      logger.info(
        {
          event: "worker_metrics",
          memory: {
            rss: memory.rss,
            heapUsed: memory.heapUsed,
            heapTotal: memory.heapTotal,
            external: memory.external,
            arrayBuffers: memory.arrayBuffers,
          },
          queues: {
            refresh: { ...refreshCounts, oldestWaitingAgeMs: refreshOldest },
            backfill: { ...backfillCounts, oldestWaitingAgeMs: backfillOldest },
          },
          jobs: takeJobCounters(),
          rateLimit: {
            refreshRemainingMs: Math.max(0, rateLimitUntil.refresh - now),
            backfillRemainingMs: Math.max(0, rateLimitUntil.backfill - now),
          },
          databasePool: {
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount,
          },
        },
        "Worker resource metrics",
      );
    } catch (error) {
      logger.warn(
        {
          event: "worker_metrics_error",
          errorType: error instanceof Error ? error.name : "UnknownError",
        },
        "Worker metrics collection failed",
      );
    } finally {
      collecting = false;
    }
  };

  const timer = setInterval(() => void collect(), intervalMs);
  timer.unref();
  return () => {
    clearInterval(timer);
  };
}
