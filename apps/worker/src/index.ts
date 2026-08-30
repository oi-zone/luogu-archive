import "dotenv/config";
import "./sentry.js";

import * as Sentry from "@sentry/node";

import { closeDb } from "@luogu-discussion-archive/db";
import logger, { closeLogger } from "@luogu-discussion-archive/logging";
import { boundedInteger, closeQueues } from "@luogu-discussion-archive/queue";

import { resumeBackfills } from "./backfill.js";
import { startMetrics } from "./metrics.js";
import { configureSchedulers } from "./schedulers.js";
import { runShutdownSequence } from "./shutdown.js";
import { backfillWorker, refreshWorker } from "./worker.js";

const SHUTDOWN_TIMEOUT_MS = boundedInteger(
  "WORKER_SHUTDOWN_TIMEOUT_MS",
  30_000,
  1_000,
  120_000,
);
const BACKFILL_RESUME_INTERVAL_MS = boundedInteger(
  "BACKFILL_RESUME_INTERVAL_MS",
  60_000,
  10_000,
  3_600_000,
);
const CONNECTION_CLOSE_TIMEOUT_MS = Math.min(5_000, SHUTDOWN_TIMEOUT_MS);

let shuttingDown = false;
let exitCode = 0;
let resumeTimer: NodeJS.Timeout | null = null;
let resumingBackfills = false;
let stopMetrics: () => void = () => undefined;

function withTimeout<T>(
  label: string,
  operation: Promise<T>,
  timeoutMs = SHUTDOWN_TIMEOUT_MS,
) {
  return Promise.race([
    operation,
    new Promise<never>((_resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${label} exceeded shutdown timeout`));
      }, timeoutMs);
      timer.unref();
    }),
  ]);
}

async function shutdown(reason: string, error?: unknown) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (error) exitCode = 1;

  logger.info(
    {
      event: "worker_shutdown",
      reason,
      ...(error instanceof Error ? { errorType: error.name } : {}),
    },
    "Worker shutdown started",
  );

  try {
    if (resumeTimer) clearInterval(resumeTimer);
    stopMetrics();
    await runShutdownSequence({
      stopAccepting: () =>
        withTimeout(
          "worker pause",
          Promise.all([refreshWorker.pause(true), backfillWorker.pause(true)]),
          CONNECTION_CLOSE_TIMEOUT_MS,
        ),
      closeWorkers: () =>
        withTimeout(
          "worker close",
          Promise.all([refreshWorker.close(), backfillWorker.close()]),
        ),
      closeQueues: () =>
        withTimeout("queue close", closeQueues(), CONNECTION_CLOSE_TIMEOUT_MS),
      // BullMQ owns these connections; worker.close/queue.close above close them.
      closeRedis: () => Promise.resolve(),
      closeLogger: () => {
        logger.info(
          { event: "worker_shutdown_complete" },
          "Worker queues closed",
        );
        return closeLogger();
      },
      closeSentry: () => Sentry.close(5_000),
      closeDatabase: () =>
        withTimeout("database close", closeDb(), CONNECTION_CLOSE_TIMEOUT_MS),
    });
  } catch (shutdownError) {
    exitCode = 1;
    process.stderr.write(
      `Worker shutdown failed: ${
        shutdownError instanceof Error ? shutdownError.name : "unknown error"
      }\n`,
    );
  } finally {
    process.exitCode = exitCode;
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void shutdown(signal));
}
process.once(
  "uncaughtException",
  (error) => void shutdown("uncaughtException", error),
);
process.once(
  "unhandledRejection",
  (error) => void shutdown("unhandledRejection", error),
);

await configureSchedulers();
await resumeBackfills();

resumeTimer = setInterval(() => {
  if (resumingBackfills) return;
  resumingBackfills = true;
  void resumeBackfills()
    .catch((error: unknown) => {
      logger.error(
        {
          errorType: error instanceof Error ? error.name : "UnknownError",
        },
        "Failed to resume pending backfills",
      );
    })
    .finally(() => {
      resumingBackfills = false;
    });
}, BACKFILL_RESUME_INTERVAL_MS);
resumeTimer.unref();
stopMetrics = startMetrics();

try {
  await Promise.all([refreshWorker.run(), backfillWorker.run()]);
} catch (error) {
  await shutdown("worker_run_failure", error);
}
