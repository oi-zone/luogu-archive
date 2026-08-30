import {
  and,
  db,
  desc,
  eq,
  inArray,
  lt,
  schema,
  sql,
} from "@luogu-discussion-archive/db";
import logger from "@luogu-discussion-archive/logging";
import {
  boundedInteger,
  queueBackfillJob,
  type BackfillEntityType,
  type BackfillJob,
} from "@luogu-discussion-archive/queue";

import {
  progressingCursor,
  REOPENABLE_BACKFILL_STATUSES,
} from "./backfill-policy.js";

const DIRECTION = "older" as const;
const RESUME_BATCH_SIZE = 500;
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

async function enqueueCursor(row: CursorRow) {
  const job = toJob(row);
  if (!job) return false;
  const queued = await queueBackfillJob(job);
  if (queued) return true;

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
  return false;
}

export async function ensureBackfill(options: {
  entityType: BackfillEntityType;
  entityId: string;
  initialCursor: string | null;
  reopen?: boolean;
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
            inArray(schema.CrawlCursor.status, REOPENABLE_BACKFILL_STATUSES),
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
  nextCursor: string | null,
) {
  const now = new Date();
  // A non-advancing upstream cursor would otherwise collide with the active
  // deterministic job ID and leave a pending chain that can never progress.
  const safeNextCursor = progressingCursor(job.cursor, nextCursor);
  const rows = await db
    .update(schema.CrawlCursor)
    .set({
      nextCursor: safeNextCursor,
      status: safeNextCursor ? "pending" : "completed",
      completedAt: safeNextCursor ? null : now,
      claimedAt: null,
      lastError: null,
      pagesProcessed: sql`${schema.CrawlCursor.pagesProcessed} + 1`,
      updatedAt: now,
    })
    .where(and(cursorCondition(job), eq(schema.CrawlCursor.status, "active")))
    .returning();

  const row = rows[0];
  if (row && safeNextCursor) await enqueueCursor(row);
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

  const pending = await db
    .select()
    .from(schema.CrawlCursor)
    .where(eq(schema.CrawlCursor.status, "pending"))
    .orderBy(desc(schema.CrawlCursor.updatedAt))
    .limit(RESUME_BATCH_SIZE);

  let queued = 0;
  for (const row of pending) {
    if (!(await enqueueCursor(row))) break;
    queued += 1;
  }
  return { queued, staleClaims: stale.length, pending: pending.length };
}
