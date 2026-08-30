import { Queue, type Job } from "bullmq";

import {
  BACKFILL_QUEUE_MAX_DEPTH,
  BACKFILL_QUEUE_NAME,
  DEFAULT_JOB_OPTIONS,
  redisConnection,
  REFRESH_QUEUE_MAX_DEPTH,
  REFRESH_QUEUE_NAME,
  runnablePressureDepth,
} from "./config.js";
import type { BackfillJob, RefreshJob } from "./jobs.js";

export const refreshQueue = new Queue<RefreshJob, void, string>(
  REFRESH_QUEUE_NAME,
  {
    connection: redisConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  },
);

export const backfillQueue = new Queue<BackfillJob, void, string>(
  BACKFILL_QUEUE_NAME,
  {
    connection: redisConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  },
);

export interface QueueCounts {
  wait: number;
  active: number;
  delayed: number;
  prioritized: number;
  failed: number;
  completed: number;
}

interface AdmissionState {
  checkedAt: number;
  depth: number;
}

const admissionState = new WeakMap<Queue, AdmissionState>();
const ADMISSION_CACHE_MS = 2_000;

export async function getQueueCounts(queue: Queue): Promise<QueueCounts> {
  const counts = await queue.getJobCounts(
    "wait",
    "active",
    "delayed",
    "prioritized",
    "failed",
    "completed",
  );
  return {
    wait: counts.wait ?? 0,
    active: counts.active ?? 0,
    delayed: counts.delayed ?? 0,
    prioritized: counts.prioritized ?? 0,
    failed: counts.failed ?? 0,
    completed: counts.completed ?? 0,
  };
}

export async function hasQueueCapacity(
  queue: Queue,
  maximumDepth: number,
): Promise<boolean> {
  const now = Date.now();
  const cached = admissionState.get(queue);
  if (cached && now - cached.checkedAt < ADMISSION_CACHE_MS) {
    if (cached.depth >= maximumDepth) return false;
    cached.depth += 1;
    return true;
  }

  const depth = runnablePressureDepth(await getQueueCounts(queue));
  admissionState.set(queue, { checkedAt: now, depth: depth + 1 });
  return depth < maximumDepth;
}

export function hasRefreshCapacity() {
  return hasQueueCapacity(refreshQueue, REFRESH_QUEUE_MAX_DEPTH);
}

export function hasBackfillCapacity() {
  return hasQueueCapacity(backfillQueue, BACKFILL_QUEUE_MAX_DEPTH);
}

export async function closeQueues() {
  await Promise.all([refreshQueue.close(), backfillQueue.close()]);
}

export type QueuedJob = Job<RefreshJob> | Job<BackfillJob>;
