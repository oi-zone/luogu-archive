import type { JobsOptions } from "bullmq";

import { DEFAULT_JOB_OPTIONS } from "./config.js";
import {
  backfillQueue,
  hasBackfillCapacity,
  hasRefreshCapacity,
  refreshQueue,
} from "./queue.js";

interface RateLimitState {
  rateLimitCount?: number;
}

export type RefreshJob = RateLimitState &
  (
    | { type: "listDiscuss"; forum?: string; page?: number }
    | { type: "listArticles"; collection?: string; page?: number }
    | { type: "discuss"; id: number; page?: number; reopenBackfill?: boolean }
    | { type: "article"; lid: string; reopenBackfill?: boolean }
    | { type: "paste"; id: string }
    | { type: "judgement" }
  );

export type BackfillEntityType = "discussionReplies" | "articleReplies";

export type BackfillJob = RateLimitState & {
  type: "backfill";
  entityType: BackfillEntityType;
  entityId: string;
  direction: "older";
  cursor: string;
  version: number;
};

export type Job = RefreshJob | BackfillJob;

function refreshDeduplicationId(job: RefreshJob) {
  switch (job.type) {
    case "listDiscuss":
      return `listDiscuss-${job.forum ?? "all"}-${String(job.page ?? 1)}`;
    case "listArticles":
      return `listArticles-${job.collection ?? "all"}-${String(job.page ?? 1)}`;
    case "discuss":
      return `discuss-${String(job.id)}-${String(job.page ?? "current")}`;
    case "article":
      return `article-${job.lid}`;
    case "paste":
      return `paste-${job.id}`;
    case "judgement":
      return "judgement";
  }
}

function safeJobSegment(value: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new Error("Unsafe BullMQ job identifier segment");
  }
  return value;
}

export function backfillJobId(job: BackfillJob) {
  return [
    "bf",
    job.entityType,
    safeJobSegment(job.entityId),
    `v${String(job.version)}`,
    `c${safeJobSegment(job.cursor)}`,
  ].join("-");
}

export async function queueRefreshJob(
  job: RefreshJob,
  options: { critical?: boolean } = {},
) {
  if (!options.critical && !(await hasRefreshCapacity())) return null;
  return refreshQueue.add(job.type, job, {
    ...DEFAULT_JOB_OPTIONS,
    deduplication: { id: refreshDeduplicationId(job) },
  });
}

export async function queueBackfillJob(job: BackfillJob) {
  if (!(await hasBackfillCapacity())) return null;
  const options: JobsOptions = {
    ...DEFAULT_JOB_OPTIONS,
    jobId: backfillJobId(job),
  };
  return backfillQueue.add(job.type, job, options);
}
