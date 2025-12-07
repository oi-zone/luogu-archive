import * as Sentry from "@sentry/node";
import { RateLimitError, Worker } from "bullmq";

import {
  AccessError,
  HttpError,
  UnexpectedStatusError,
} from "@luogu-discussion-archive/crawler";
import logger from "@luogu-discussion-archive/logging";
import { QUEUE_NAME, type Job } from "@luogu-discussion-archive/queue";

import { processJob } from "./jobs.js";

export const worker = new Worker<Job>(
  QUEUE_NAME,
  async (job) => {
    const log = logger.child({
      id: job.id,
      name: job.name,
      data: job.data,
      opts: job.opts,
      priority: job.opts.priority,
      attemptsMade: job.attemptsMade,
      deduplicationId: job.deduplicationId,
    });

    log.info("Job processing started");

    try {
      await Sentry.startSpan(
        {
          name: job.name,
          op: "crawler",
          attributes: Object.fromEntries(
            Object.entries(job).map(([key, value]) => [`job.${key}`, value]),
          ),
        },
        (span) =>
          processJob(job.data, job.opts.priority)
            .then(() => span.setStatus({ code: 1 }))
            .catch((err: unknown) => {
              span.setStatus(
                err instanceof UnexpectedStatusError
                  ? Sentry.getSpanStatusFromHttpCode(err.status)
                  : { code: 2, message: (err as Error).message },
              );
              throw err;
            }),
      );
    } catch (err) {
      // Access denied: acknowledge and stop retrying
      if (err instanceof AccessError) {
        log.warn({ err }, "Access denied during job processing, acknowledging");
        return;
      }

      if (err instanceof HttpError) {
        const retryAfter = parseRetryAfter(
          err.response.headers.get("Retry-After"),
        );
        if (retryAfter !== null) {
          log.warn(
            { err },
            "Rate limit encountered during job processing, delaying",
          );
          await new Promise((resolve) =>
            setTimeout(resolve, retryAfter * 1000),
          );
          throw new RateLimitError();
        }
      }

      log.error({ err }, "Error during job processing");
      throw err;
    }

    log.info("Job processing completed");
  },
  { autorun: false, connection: {}, removeOnComplete: { count: 0 } },
);

worker.on("error", (err) => {
  logger.fatal({ err }, "Worker encountered an error");
});

function parseRetryAfter(retryAfter: string | null): number | null {
  if (!retryAfter) return null;
  const parsed = Number(retryAfter);
  if (!isNaN(parsed)) return parsed;

  const date = Date.parse(retryAfter);
  if (!isNaN(date)) return Math.max(0, (date - Date.now()) / 1000);

  return null;
}
