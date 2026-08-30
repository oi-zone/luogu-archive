export type BackfillStatus = "pending" | "active" | "completed" | "paused";

export interface SimulatedCursor {
  status: BackfillStatus;
  nextCursor: string | null;
  version: number;
}

export const REOPENABLE_BACKFILL_STATUSES: BackfillStatus[] = [
  "completed",
  "paused",
];

export type BackfillPageResult =
  | { state: "continue"; nextCursor: string }
  | { state: "completed" }
  | { state: "paused"; nextCursor: string; reason: "page_limit" };

export function progressingCursor(current: string, next: string | null) {
  return next === current ? null : next;
}

export function planCursorRefresh(
  existing: SimulatedCursor | null,
  initialCursor: string | null,
  reopen = false,
): { cursor: SimulatedCursor; enqueue: boolean } {
  if (!existing) {
    return {
      cursor: {
        status: initialCursor ? "pending" : "completed",
        nextCursor: initialCursor,
        version: 1,
      },
      enqueue: initialCursor !== null,
    };
  }

  if (reopen && REOPENABLE_BACKFILL_STATUSES.includes(existing.status)) {
    return {
      cursor: {
        status: initialCursor ? "pending" : "completed",
        nextCursor: initialCursor,
        version: existing.version + 1,
      },
      enqueue: initialCursor !== null,
    };
  }

  return {
    cursor: existing,
    enqueue: existing.status === "pending" && existing.nextCursor !== null,
  };
}

export function discussionNextCursor(options: {
  page: number;
  numReplies: number;
  numNewReplies: number;
  pagesProcessed: number;
  maximumPages: number;
}): BackfillPageResult {
  if (
    options.page <= 1 ||
    options.numReplies === 0 ||
    options.numNewReplies < options.numReplies
  ) {
    return { state: "completed" };
  }
  const nextCursor = String(options.page - 1);
  if (options.pagesProcessed + 1 >= options.maximumPages) {
    return { state: "paused", nextCursor, reason: "page_limit" };
  }
  return { state: "continue", nextCursor };
}

export function articleRepliesNextCursor(options: {
  lastReplyId: number | null;
  lastReplySaved: boolean;
  replyCount: number;
  newReplyCount: number;
  pagesProcessed: number;
  maximumPages: number;
}): BackfillPageResult {
  if (
    !options.lastReplyId ||
    options.lastReplySaved ||
    options.replyCount === 0 ||
    options.newReplyCount < options.replyCount
  ) {
    return { state: "completed" };
  }
  const nextCursor = String(options.lastReplyId);
  if (options.pagesProcessed + 1 >= options.maximumPages) {
    return { state: "paused", nextCursor, reason: "page_limit" };
  }
  return { state: "continue", nextCursor };
}
