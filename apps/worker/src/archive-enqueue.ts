import "dotenv/config";

import { closeDb } from "@luogu-discussion-archive/db";
import { closeLogger } from "@luogu-discussion-archive/logging";
import {
  closeQueues,
  queueRefreshJob,
  type RefreshJob,
} from "@luogu-discussion-archive/queue";

function usage(): never {
  throw new Error(
    "Usage: archive:enqueue <article|discussion|paste|judgement> <id> [--reopen-backfill]",
  );
}

function parseJob(args: string[]): RefreshJob {
  const [entity, id] = args;
  const reopenBackfill = args.includes("--reopen-backfill");
  if (!entity) return usage();

  if (entity === "judgement") {
    if (id && id !== "--reopen-backfill") return usage();
    return { type: "judgement" };
  }
  if (!id) return usage();

  if (entity === "discussion") {
    if (!/^[1-9]\d{0,9}$/.test(id)) throw new Error("Invalid discussion ID");
    const numericId = Number(id);
    if (!Number.isSafeInteger(numericId) || numericId > 2_147_483_647)
      throw new Error("Invalid discussion ID");
    return {
      type: "discuss",
      id: numericId,
      ...(reopenBackfill ? { reopenBackfill: true } : {}),
    };
  }

  if (!/^[a-z0-9]{8}$/.test(id)) {
    throw new Error(`Invalid ${entity} ID`);
  }
  if (entity === "article") {
    return {
      type: "article",
      lid: id,
      ...(reopenBackfill ? { reopenBackfill: true } : {}),
    };
  }
  if (entity === "paste") {
    if (reopenBackfill)
      throw new Error("Paste jobs do not support backfill reopening");
    return { type: "paste", id };
  }
  return usage();
}

let exitCode = 0;
try {
  const job = parseJob(process.argv.slice(2));
  const queued = await queueRefreshJob(job);
  if (!queued) {
    throw new Error("Queue admission rejected at the configured depth limit");
  }
  process.stdout.write(
    `${JSON.stringify({ queued: true, queue: "luogu-refresh", type: job.type, jobId: queued.id })}\n`,
  );
} catch (error) {
  exitCode = 1;
  process.stderr.write(
    `${error instanceof Error ? error.message : "Failed to enqueue archive job"}\n`,
  );
} finally {
  await closeQueues();
  await closeDb();
  await closeLogger();
}
process.exitCode = exitCode;
