import type { DeduplicationOptions, JobsOptions } from "bullmq";

import { queue } from "./queue.js";

export type Job =
  | { type: "listDiscuss"; forum?: string; page?: number }
  | { type: "listArticles"; collection?: string; page?: number }
  | { type: "discuss"; id: number; page?: number }
  | { type: "article"; lid: string }
  | { type: "articleReplies"; lid: string; after?: number }
  | { type: "paste"; id: string }
  | { type: "judgement" };

export function queueJob(job: Job, priority?: number) {
  const deduplication: DeduplicationOptions = { id: "" };
  switch (job.type) {
    case "listDiscuss":
      deduplication.id = `listDiscuss:${job.forum ?? "all"}:${String(job.page ?? 1)}`;
      break;

    case "listArticles":
      deduplication.id = `listArticles:${
        job.collection ?? "all"
      }:${String(job.page ?? 1)}`;
      break;

    case "discuss":
      deduplication.id = `discuss:${String(job.id)}:${String(job.page ?? 1)}`;
      break;

    case "article":
      deduplication.id = `article:${job.lid}`;
      break;

    case "articleReplies":
      deduplication.id = `articleReplies:${job.lid}:${String(job.after)}`;
      break;

    case "paste":
      deduplication.id = `paste:${job.id}`;
      break;

    case "judgement":
      deduplication.id = "judgement";
      break;

    default:
  }

  const opts: JobsOptions = { deduplication };
  if (priority) opts.priority = priority;

  return queue.add(job.type, job, opts);
}
