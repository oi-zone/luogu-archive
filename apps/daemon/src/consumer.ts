import { AccessError } from "@luogu-discussion-archive/crawler";
import logger from "@luogu-discussion-archive/logging";
import {
  client,
  STREAM_IMMEDIATE,
  STREAM_ROUTINE,
  type Job,
} from "@luogu-discussion-archive/redis";

import {
  BLOCK_IMMEDIATE_MS,
  GROUP_NAME,
  JOB_MAX_ATTEMPTS,
  JOB_RETRY_DELAY_MS,
} from "./config.js";
import { perform } from "./tasks.js";

export async function consume(consumerName: string) {
  const log = logger.child({ consumer: consumerName });
  log.info("Consumer started");

  const lastId = { [STREAM_IMMEDIATE]: "0-0", [STREAM_ROUTINE]: "0-0" };
  const checkingBacklog = { [STREAM_IMMEDIATE]: true, [STREAM_ROUTINE]: true };

  for (;;) {
    log.debug({ lastId, checkingBacklog }, "Reading from stream");
    let result = await client.xReadGroup(
      GROUP_NAME,
      consumerName,
      [
        {
          key: STREAM_IMMEDIATE,
          id: checkingBacklog[STREAM_IMMEDIATE]
            ? lastId[STREAM_IMMEDIATE]
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
          key: STREAM_ROUTINE,
          id: checkingBacklog[STREAM_ROUTINE] ? lastId[STREAM_ROUTINE] : ">",
        },
      ],
      { COUNT: 1 },
    );
    log.debug({ result }, "Read result");

    if (!result) continue;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { name, messages } = result[0]!;
    const stream = name as typeof STREAM_IMMEDIATE | typeof STREAM_ROUTINE;

    if (!messages.length) checkingBacklog[stream] = false;

    for (const { id, message } of messages) {
      const job = message as unknown as Job;
      const jobLog = log.child({ id, job });
      jobLog.info("Job processing started");
      for (let attempt = 1; ; ++attempt) {
        try {
          await perform(job, stream);
          break;
        } catch (err) {
          // Access denied: acknowledge and stop retrying
          if (err instanceof AccessError) {
            jobLog.warn(
              { err },
              "Access denied during job processing, acknowledging",
            );
            break;
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

          const delay = JOB_RETRY_DELAY_MS * attempt;
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
