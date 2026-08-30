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
    | {
        type: "visibilityScan";
        entityType: "article" | "discussion" | "paste";
      }
    | {
        type: "visibilityRevalidate";
        entityType: "article" | "discussion" | "paste";
        entityId: string;
      }
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
    case "visibilityScan":
      return `visibility-scan-${job.entityType}`;
    case "visibilityRevalidate":
      return `visibility-${job.entityType}-${safeJobSegment(job.entityId)}`;
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

export type QueueBackfillResult =
  | { state: "added"; jobId: string }
  | { state: "already_live"; jobId: string }
  | { state: "blocked_by_capacity"; jobId: string }
  | {
      state: "terminal_conflict";
      jobId: string;
      jobState: "completed" | "failed";
    };

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

export async function queueBackfillJob(
  job: BackfillJob,
): Promise<QueueBackfillResult> {
  const jobId = backfillJobId(job);
  let existing = await backfillQueue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (state === "completed" || state === "failed") {
      return { state: "terminal_conflict", jobId, jobState: state };
    }
    if (state !== "unknown") return { state: "already_live", jobId };
    await existing.remove().catch(() => undefined);
    existing = undefined;
  }

  if (!(await hasBackfillCapacity())) {
    return { state: "blocked_by_capacity", jobId };
  }
  const options: JobsOptions = {
    ...DEFAULT_JOB_OPTIONS,
    jobId,
  };
  const added = await backfillQueue.add(job.type, job, options);
  const state = await added.getState();
  if (state === "completed" || state === "failed") {
    return { state: "terminal_conflict", jobId, jobState: state };
  }
  return { state: "added", jobId };
}
