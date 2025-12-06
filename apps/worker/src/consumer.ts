import * as Sentry from "@sentry/node";

import {
  AccessError,
  HttpError,
  UnexpectedStatusError,
} from "@luogu-discussion-archive/crawler";
import logger from "@luogu-discussion-archive/logging";
import { client, Stream, type Job } from "@luogu-discussion-archive/redis";

import {
  BLOCK_IMMEDIATE_MS,
  GROUP_NAME,
  JOB_MAX_ATTEMPTS,
  JOB_RETRY_DELAY_MS,
} from "./config.js";
import { execute } from "./jobs.js";

export async function consume(consumerName: string) {
  const log = logger.child({ consumer: consumerName });
  log.info("Consumer started");

  const lastId = { [Stream.Immediate]: "0-0", [Stream.Routine]: "0-0" };
  const checkingBacklog = { [Stream.Immediate]: true, [Stream.Routine]: true };

  for (;;) {
    log.debug({ lastId, checkingBacklog }, "Reading from stream");
    let result = await client.xReadGroup(
      GROUP_NAME,
      consumerName,
      [
        {
          key: Stream.Immediate,
          id: checkingBacklog[Stream.Immediate]
            ? lastId[Stream.Immediate]
            : ">",
        },
      ],
      { BLOCK: BLOCK_IMMEDIATE_MS, COUNT: 1 },
    );

    result ??= await client.xReadGroup(
      GROUP_NAME,
      consumerName,
      [
        {
          key: Stream.Routine,
          id: checkingBacklog[Stream.Routine] ? lastId[Stream.Routine] : ">",
        },
      ],
      { COUNT: 1 },
    );
    log.debug({ result }, "Read result");

    if (!result) continue;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { name, messages } = result[0]!;
    const stream = name as Stream;

    if (!messages.length) checkingBacklog[stream] = false;

    for (const { id, message } of messages) {
      const job = message as unknown as Job;
      const jobLog = log.child({ stream, id, job });
      jobLog.info("Job processing started");
      for (let attempt = 1; ; ++attempt) {
        try {
          await Sentry.startSpan(
            {
              name: job.type,
              op: "crawler",
              attributes: Object.fromEntries(
                Object.entries(job).map(([key, value]) => [
                  `job.${key}`,
                  value,
                ]),
              ),
            },
            (span) =>
              execute(job, stream)
                .then(() => span.setStatus({ code: 1 }))
                .catch((err: unknown) => {
                  span.setStatus(
                    err instanceof UnexpectedStatusError
                      ? Sentry.getSpanStatusFromHttpCode(err.status)
                      : { code: 2, message: (err as Error).message },
                  );
                  // Access denied: acknowledge and stop retrying
                  if (err instanceof AccessError)
                    jobLog.warn(
                      { err },
                      "Access denied during job processing, acknowledging",
                    );
                  else throw err;
                }),
          );
          break;
        } catch (err) {
          if (err instanceof HttpError && err.status === 429) {
            const retryAfter = parseRetryAfter(
              err.response.headers.get("Retry-After"),
            );
            if (retryAfter) {
              jobLog.warn(
                { retryAfter },
                "Received 429 Too Many Requests, delaying retry",
              );
              await new Promise((resolve) =>
                setTimeout(resolve, retryAfter * 1000),
              );
              continue;
            }
          }

          const willRetry = attempt < JOB_MAX_ATTEMPTS;
          jobLog.error(
            { err, attempt, willRetry },
            "Error during job processing",
          );

          if (!willRetry) {
            // Requeue the job to the end of the same stream and acknowledge the old entry
            jobLog.warn(
              { attempt },
              "Max attempts reached, requeuing job to end of stream",
            );
            await client.xAdd(stream, "*", job);
            jobLog.info("Job requeued");
            break;
          }

          const delay = JOB_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          jobLog.info({ attempt, delay }, "Retrying job after delay");
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      await client.xAckDel(stream, GROUP_NAME, id, "ACKED");
      jobLog.info("Job processing completed");
      lastId[stream] = id;
    }
  }
}

function parseRetryAfter(retryAfter: string | null): number | null {
  if (!retryAfter) return null;
  const parsed = Number(retryAfter);
  if (!isNaN(parsed)) return parsed;

  const date = Date.parse(retryAfter);
  if (!isNaN(date)) return Math.max(0, (date - Date.now()) / 1000);

  return null;
}
