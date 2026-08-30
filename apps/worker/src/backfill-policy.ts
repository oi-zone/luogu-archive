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
}) {
  if (
    options.page <= 1 ||
    options.numReplies === 0 ||
    options.numNewReplies === 0 ||
    options.pagesProcessed + 1 >= options.maximumPages
  ) {
    return null;
  }
  return String(options.page - 1);
}

export function articleRepliesNextCursor(options: {
  lastReplyId: number | null;
  lastReplySaved: boolean;
  replyCount: number;
  newReplyCount: number;
  pagesProcessed: number;
  maximumPages: number;
}) {
  if (
    !options.lastReplyId ||
    options.lastReplySaved ||
    options.replyCount === 0 ||
    options.newReplyCount === 0 ||
    options.pagesProcessed + 1 >= options.maximumPages
  ) {
    return null;
  }
  return String(options.lastReplyId);
}
