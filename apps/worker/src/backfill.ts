import {
  and,
  asc,
  db,
  eq,
  gt,
  inArray,
  lt,
  or,
  schema,
  sql,
} from "@luogu-discussion-archive/db";
import logger from "@luogu-discussion-archive/logging";
import {
  boundedInteger,
  queueBackfillJob,
  type BackfillEntityType,
  type BackfillJob,
  type QueueBackfillResult,
} from "@luogu-discussion-archive/queue";

import {
  REOPENABLE_BACKFILL_STATUSES,
  type BackfillPageResult,
} from "./backfill-policy.js";

const DIRECTION = "older" as const;
const RESUME_PAGE_SIZE = 100;
const RESUME_SCAN_LIMIT = boundedInteger(
  "BACKFILL_RESUME_SCAN_LIMIT",
  1_000,
  100,
  5_000,
);
const CLAIM_TIMEOUT_MS = boundedInteger(
  "BACKFILL_CLAIM_TIMEOUT_MS",
  15 * 60 * 1000,
  60_000,
  24 * 60 * 60 * 1000,
);

let lastBackpressureWarningAt = 0;
const BACKPRESSURE_WARNING_INTERVAL_MS = 60_000;

type CursorRow = typeof schema.CrawlCursor.$inferSelect;

function cursorCondition(job: BackfillJob) {
  return and(
    eq(schema.CrawlCursor.entityType, job.entityType),
    eq(schema.CrawlCursor.entityId, job.entityId),
    eq(schema.CrawlCursor.direction, job.direction),
    eq(schema.CrawlCursor.version, job.version),
    eq(schema.CrawlCursor.nextCursor, job.cursor),
  );
}

function toJob(row: CursorRow): BackfillJob | null {
  if (row.status !== "pending" || !row.nextCursor) return null;
  return {
    type: "backfill",
    entityType: row.entityType as BackfillEntityType,
    entityId: row.entityId,
    direction: DIRECTION,
    cursor: row.nextCursor,
    version: row.version,
  };
}

async function enqueueCursor(
  row: CursorRow,
): Promise<QueueBackfillResult | { state: "not_pending" }> {
  const job = toJob(row);
  if (!job) return { state: "not_pending" };
  const result = await queueBackfillJob(job);
  if (result.state === "added" || result.state === "already_live") {
    return result;
  }

  if (result.state === "terminal_conflict") {
    await db
      .update(schema.CrawlCursor)
      .set({
        status: "paused",
        claimedAt: null,
        lastError: `Terminal ${result.jobState} BullMQ job conflicts with pending cursor`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.CrawlCursor.entityType, row.entityType),
          eq(schema.CrawlCursor.entityId, row.entityId),
          eq(schema.CrawlCursor.version, row.version),
          eq(schema.CrawlCursor.status, "pending"),
        ),
      );
    return result;
  }

  const now = Date.now();
  if (now - lastBackpressureWarningAt >= BACKPRESSURE_WARNING_INTERVAL_MS) {
    lastBackpressureWarningAt = now;
    logger.warn(
      {
        event: "queue_backpressure",
        queue: "backfill",
        entityType: row.entityType,
      },
      "Backfill admission paused at configured queue depth",
    );
  }
  return result;
}

export async function ensureBackfill(options: {
  entityType: BackfillEntityType;
  entityId: string;
  initialCursor: string | null;
  reopen?: "delta" | "explicit" | boolean;
}) {
  const now = new Date();
  const row = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(schema.CrawlCursor)
      .values({
        entityType: options.entityType,
        entityId: options.entityId,
        direction: DIRECTION,
        nextCursor: options.initialCursor,
        status: options.initialCursor ? "pending" : "completed",
        pagesProcessed: 0,
        version: 1,
        completedAt: options.initialCursor ? null : now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted[0]) return inserted[0];

    if (options.reopen) {
      const reopenMode = options.reopen === true ? "explicit" : options.reopen;
      const reopenableStatuses =
        reopenMode === "delta"
          ? (["completed"] as const)
          : REOPENABLE_BACKFILL_STATUSES;
      const reopened = await tx
        .update(schema.CrawlCursor)
        .set({
          nextCursor: options.initialCursor,
          status: options.initialCursor ? "pending" : "completed",
          completedAt: options.initialCursor ? null : now,
          claimedAt: null,
          lastError: null,
          pagesProcessed: 0,
          version: sql`${schema.CrawlCursor.version} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.CrawlCursor.entityType, options.entityType),
            eq(schema.CrawlCursor.entityId, options.entityId),
            eq(schema.CrawlCursor.direction, DIRECTION),
            inArray(schema.CrawlCursor.status, reopenableStatuses),
          ),
        )
        .returning();
      if (reopened[0]) return reopened[0];
    }

    const existing = await tx
      .select()
      .from(schema.CrawlCursor)
      .where(
        and(
          eq(schema.CrawlCursor.entityType, options.entityType),
          eq(schema.CrawlCursor.entityId, options.entityId),
          eq(schema.CrawlCursor.direction, DIRECTION),
        ),
      )
      .limit(1);
    return existing[0];
  });

  if (row) await enqueueCursor(row);
  return row ?? null;
}

export async function claimBackfill(job: BackfillJob) {
  const now = new Date();
  const rows = await db
    .update(schema.CrawlCursor)
    .set({ status: "active", claimedAt: now, updatedAt: now })
    .where(and(cursorCondition(job), eq(schema.CrawlCursor.status, "pending")))
    .returning();
  return rows[0] ?? null;
}

export async function advanceBackfill(
  job: BackfillJob,
  result: BackfillPageResult,
) {
  const now = new Date();
  const nonProgressing =
    result.state !== "completed" && result.nextCursor === job.cursor;
  const nextCursor = result.state === "completed" ? null : result.nextCursor;
  const status = nonProgressing
    ? "paused"
    : result.state === "continue"
      ? "pending"
      : result.state;
  const rows = await db
    .update(schema.CrawlCursor)
    .set({
      nextCursor,
      status,
      completedAt: status === "completed" ? now : null,
      claimedAt: null,
      lastError:
        status === "paused"
          ? nonProgressing
            ? "non_progressing_cursor"
            : result.state === "paused"
              ? result.reason
              : "paused"
          : null,
      pagesProcessed: sql`${schema.CrawlCursor.pagesProcessed} + 1`,
      updatedAt: now,
    })
    .where(and(cursorCondition(job), eq(schema.CrawlCursor.status, "active")))
    .returning();

  const row = rows[0];
  if (row && status === "pending") await enqueueCursor(row);
  return row ?? null;
}

function boundedError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return message
    .replace(/(?:cookie|authorization)\s*[:=]\s*\S+/gi, "[redacted]")
    .slice(0, 512);
}

export async function releaseBackfill(job: BackfillJob, error: unknown) {
  await db
    .update(schema.CrawlCursor)
    .set({
      status: "pending",
      claimedAt: null,
      lastError: boundedError(error),
      updatedAt: new Date(),
    })
    .where(and(cursorCondition(job), eq(schema.CrawlCursor.status, "active")));
}

export async function pauseBackfill(job: BackfillJob, error: unknown) {
  await db
    .update(schema.CrawlCursor)
    .set({
      status: "paused",
      claimedAt: null,
      lastError: boundedError(error),
      updatedAt: new Date(),
    })
    .where(cursorCondition(job));
}

export async function resumeBackfills() {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - CLAIM_TIMEOUT_MS);
  const stale = await db
    .update(schema.CrawlCursor)
    .set({
      status: "pending",
      claimedAt: null,
      lastError: "Recovered stale worker claim",
      updatedAt: now,
    })
    .where(
      and(
        eq(schema.CrawlCursor.status, "active"),
        lt(schema.CrawlCursor.updatedAt, staleBefore),
      ),
    )
    .returning({ entityId: schema.CrawlCursor.entityId });

  if (stale.length) {
    logger.warn(
      { event: "backfill_claim_recovered", count: stale.length },
      "Recovered stale backfill claims",
    );
  }

  let scanned = 0;
  let added = 0;
  let alreadyLive = 0;
  let terminalConflicts = 0;
  let blockedByCapacity = false;
  await db
    .insert(schema.BackfillResumeState)
    .values({ name: "pending", updatedAt: now })
    .onConflictDoNothing();
  const [resumeState] = await db
    .select()
    .from(schema.BackfillResumeState)
    .where(eq(schema.BackfillResumeState.name, "pending"))
    .limit(1);
  let after: Pick<CursorRow, "updatedAt" | "entityType" | "entityId"> | null =
    resumeState?.afterUpdatedAt &&
    resumeState.afterEntityType &&
    resumeState.afterEntityId
      ? {
          updatedAt: resumeState.afterUpdatedAt,
          entityType: resumeState.afterEntityType,
          entityId: resumeState.afterEntityId,
        }
      : null;
  let wrapped = false;

  while (scanned < RESUME_SCAN_LIMIT) {
    const requestedLimit = Math.min(
      RESUME_PAGE_SIZE,
      RESUME_SCAN_LIMIT - scanned,
    );
    const page = await db
      .select()
      .from(schema.CrawlCursor)
      .where(
        and(
          eq(schema.CrawlCursor.status, "pending"),
          after
            ? or(
                gt(schema.CrawlCursor.updatedAt, after.updatedAt),
                and(
                  eq(schema.CrawlCursor.updatedAt, after.updatedAt),
                  gt(schema.CrawlCursor.entityType, after.entityType),
                ),
                and(
                  eq(schema.CrawlCursor.updatedAt, after.updatedAt),
                  eq(schema.CrawlCursor.entityType, after.entityType),
                  gt(schema.CrawlCursor.entityId, after.entityId),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(
        asc(schema.CrawlCursor.updatedAt),
        asc(schema.CrawlCursor.entityType),
        asc(schema.CrawlCursor.entityId),
      )
      .limit(requestedLimit);
    if (page.length === 0) {
      after = null;
      wrapped = true;
      break;
    }

    for (const row of page) {
      const result = await enqueueCursor(row);
      if (result.state === "blocked_by_capacity") {
        blockedByCapacity = true;
        break;
      }
      scanned += 1;
      after = row;
      if (result.state === "added") added += 1;
      else if (result.state === "already_live") alreadyLive += 1;
      else if (result.state === "terminal_conflict") terminalConflicts += 1;
    }
    if (blockedByCapacity) break;
    if (page.length < requestedLimit) {
      after = null;
      wrapped = true;
      break;
    }
  }

  await db
    .update(schema.BackfillResumeState)
    .set({
      afterUpdatedAt: after?.updatedAt ?? null,
      afterEntityType: after?.entityType ?? null,
      afterEntityId: after?.entityId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(schema.BackfillResumeState.name, "pending"));

  return {
    queued: added,
    added,
    alreadyLive,
    terminalConflicts,
    blockedByCapacity,
    staleClaims: stale.length,
    scanned,
    wrapped,
  };
}
