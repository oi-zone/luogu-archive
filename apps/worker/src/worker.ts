import * as Sentry from "@sentry/node";
import { Worker, type Job as BullJob } from "bullmq";

import {
  AccessError,
  HttpError,
  UnexpectedStatusError,
} from "@luogu-discussion-archive/crawler";
import logger from "@luogu-discussion-archive/logging";
import {
  BACKFILL_QUEUE_NAME,
  boundedInteger,
  COMPLETED_RETENTION,
  FAILED_RETENTION,
  redisConnection,
  REFRESH_QUEUE_NAME,
  type BackfillJob,
  type RefreshJob,
} from "@luogu-discussion-archive/queue";

import { pauseBackfill } from "./backfill.js";
import { processBackfillJob, processRefreshJob } from "./jobs.js";

const MAX_CONSECUTIVE_RATE_LIMITS = boundedInteger(
  "WORKER_MAX_CONSECUTIVE_RATE_LIMITS",
  8,
  1,
  100,
);

type WorkerJob = RefreshJob | BackfillJob;

export const rateLimitUntil = {
  refresh: 0,
  backfill: 0,
};

const jobCounters = new Map<string, { processed: number; failed: number }>();
const lastHighFrequencyErrorAt = new Map<string, number>();
const HIGH_FREQUENCY_ERROR_INTERVAL_MS = 60_000;

function recordJob(type: string, failed: boolean) {
  const counter = jobCounters.get(type) ?? { processed: 0, failed: 0 };
  if (failed) counter.failed += 1;
  else counter.processed += 1;
  jobCounters.set(type, counter);
}

export function takeJobCounters() {
  const snapshot = Object.fromEntries(jobCounters);
  jobCounters.clear();
  return snapshot;
}

function shouldReportHighFrequencyError(key: string) {
  const now = Date.now();
  const previous = lastHighFrequencyErrorAt.get(key) ?? 0;
  if (now - previous < HIGH_FREQUENCY_ERROR_INTERVAL_MS) return false;
  lastHighFrequencyErrorAt.set(key, now);
  return true;
}

function safeJobContext(job: BullJob<WorkerJob>, queue: string) {
  return {
    queue,
    jobId: job.id,
    jobType: job.data.type,
    attemptsMade: job.attemptsMade,
    ...(job.data.type === "backfill"
      ? {
          entityType: job.data.entityType,
          entityId: job.data.entityId,
          cursorVersion: job.data.version,
        }
      : {}),
  };
}

async function runJob<T extends WorkerJob>(
  job: BullJob<T>,
  worker: Worker<T>,
  queueName: string,
  processor: (data: T) => Promise<void>,
) {
  const context = safeJobContext(job as BullJob<WorkerJob>, queueName);
  const log = logger.child(context);

  log.info("Job processing started");

  try {
    await Sentry.startSpan(
      {
        name: job.data.type,
        op: "crawler",
        attributes: {
          "job.queue": queueName,
          "job.type": job.data.type,
          "job.attempt": job.attemptsMade,
          ...(job.data.type === "backfill"
            ? {
                "job.entity_type": job.data.entityType,
                "job.cursor_version": job.data.version,
              }
            : {}),
        },
      },
      async (span) => {
        try {
          await processor(job.data);
          span.setStatus({ code: 1 });
        } catch (error) {
          span.setStatus(
            error instanceof UnexpectedStatusError
              ? Sentry.getSpanStatusFromHttpCode(error.status)
              : { code: 2 },
          );
          throw error;
        }
      },
    );
  } catch (error) {
    if (error instanceof AccessError) {
      log.warn(
        { status: error.status },
        "Access denied during job processing, acknowledging",
      );
      return;
    }

    if (error instanceof HttpError && error.retryAfterMs !== null) {
      const rateLimitCount = (job.data.rateLimitCount ?? 0) + 1;
      await job.updateData({ ...job.data, rateLimitCount });
      if (rateLimitCount > MAX_CONSECUTIVE_RATE_LIMITS) {
        if (job.data.type === "backfill") {
          await pauseBackfill(
            job.data,
            new Error("Consecutive upstream rate limit limit exceeded"),
          );
        }
        throw new Error("Consecutive upstream rate limit limit exceeded");
      }

      log.warn(
        {
          status: error.status,
          retryAfterMs: error.retryAfterMs,
          rateLimitCount,
        },
        "Upstream rate limit activated",
      );
      if (queueName === REFRESH_QUEUE_NAME) {
        rateLimitUntil.refresh = Date.now() + error.retryAfterMs;
      } else {
        rateLimitUntil.backfill = Date.now() + error.retryAfterMs;
      }
      // BullMQ 5 still documents this method for manual processor rate limits.
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      await worker.rateLimit(error.retryAfterMs);
      throw Worker.RateLimitError();
    }

    const errorType = error instanceof Error ? error.name : "UnknownError";
    const reportKey = `${queueName}:${job.data.type}:${errorType}`;
    if (shouldReportHighFrequencyError(reportKey)) {
      log.error(
        {
          errorType,
        },
        "Error during job processing",
      );
      Sentry.captureException(new Error(`Worker job failed: ${errorType}`), {
        tags: { queue: queueName, jobType: job.data.type },
      });
    }
    throw error;
  }

  log.info("Job processing completed");
}

export const refreshWorker: Worker<RefreshJob> = new Worker<RefreshJob>(
  REFRESH_QUEUE_NAME,
  (job) => runJob(job, refreshWorker, REFRESH_QUEUE_NAME, processRefreshJob),
  {
    autorun: false,
    connection: redisConnection(),
    concurrency: boundedInteger("REFRESH_WORKER_CONCURRENCY", 4, 1, 64),
    limiter: {
      max: boundedInteger("REFRESH_RATE_LIMIT_MAX", 30, 1, 10_000),
      duration: boundedInteger(
        "REFRESH_RATE_LIMIT_DURATION_MS",
        60_000,
        1_000,
        3_600_000,
      ),
    },
    removeOnComplete: COMPLETED_RETENTION,
    removeOnFail: FAILED_RETENTION,
  },
);

export const backfillWorker: Worker<BackfillJob> = new Worker<BackfillJob>(
  BACKFILL_QUEUE_NAME,
  (job) => runJob(job, backfillWorker, BACKFILL_QUEUE_NAME, processBackfillJob),
  {
    autorun: false,
    connection: redisConnection(),
    concurrency: boundedInteger("BACKFILL_WORKER_CONCURRENCY", 1, 1, 16),
    limiter: {
      max: boundedInteger("BACKFILL_RATE_LIMIT_MAX", 10, 1, 10_000),
      duration: boundedInteger(
        "BACKFILL_RATE_LIMIT_DURATION_MS",
        60_000,
        1_000,
        3_600_000,
      ),
    },
    removeOnComplete: COMPLETED_RETENTION,
    removeOnFail: FAILED_RETENTION,
  },
);

for (const worker of [refreshWorker, backfillWorker]) {
  worker.on("error", (error) => {
    logger.error({ errorType: error.name }, "Worker connection error");
  });
  worker.on("completed", (job) => {
    recordJob(job.data.type, false);
  });
  worker.on("failed", (job) => {
    if (job) recordJob(job.data.type, true);
  });
}
