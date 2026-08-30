import {
  and,
  asc,
  db,
  eq,
  gt,
  isNull,
  schema,
  sql,
} from "@luogu-discussion-archive/db";
import logger from "@luogu-discussion-archive/logging";
import {
  boundedInteger,
  queueRefreshJob,
  type RefreshJob,
} from "@luogu-discussion-archive/queue";

export type VisibilityEntityType = "article" | "discussion" | "paste";

export const VISIBILITY_REVALIDATION_BATCH_SIZE = boundedInteger(
  "VISIBILITY_REVALIDATION_BATCH_SIZE",
  50,
  1,
  100,
);

export async function scanVisibilityBatch(
  entityType: VisibilityEntityType,
  enqueue: (
    job: RefreshJob,
  ) => ReturnType<typeof queueRefreshJob> = queueRefreshJob,
) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${"visibility-scan:" + entityType}))`,
    );
    await tx
      .insert(schema.VisibilityScanState)
      .values({ entityType, afterId: null, cycle: 1, updatedAt: new Date() })
      .onConflictDoNothing();
    const [state] = await tx
      .select()
      .from(schema.VisibilityScanState)
      .where(eq(schema.VisibilityScanState.entityType, entityType))
      .limit(1);
    if (!state) throw new Error("Visibility scan state was not created");

    let rows: { id: string }[];
    if (entityType === "discussion") {
      const numericAfter =
        state.afterId === null ? null : Number(state.afterId);
      if (
        numericAfter !== null &&
        (!Number.isSafeInteger(numericAfter) || numericAfter <= 0)
      ) {
        throw new Error("Invalid persisted discussion visibility cursor");
      }
      const discussions = await tx
        .select({ id: schema.Post.id })
        .from(schema.Post)
        .where(
          numericAfter === null ? undefined : gt(schema.Post.id, numericAfter),
        )
        .orderBy(asc(schema.Post.id))
        .limit(VISIBILITY_REVALIDATION_BATCH_SIZE);
      rows = discussions.map(({ id }) => ({ id: String(id) }));
    } else if (entityType === "article") {
      rows = await tx
        .select({ id: schema.Article.lid })
        .from(schema.Article)
        .where(
          state.afterId === null
            ? undefined
            : gt(schema.Article.lid, state.afterId),
        )
        .orderBy(asc(schema.Article.lid))
        .limit(VISIBILITY_REVALIDATION_BATCH_SIZE);
    } else {
      rows = await tx
        .select({ id: schema.Paste.id })
        .from(schema.Paste)
        .where(
          state.afterId === null
            ? undefined
            : gt(schema.Paste.id, state.afterId),
        )
        .orderBy(asc(schema.Paste.id))
        .limit(VISIBILITY_REVALIDATION_BATCH_SIZE);
    }
    if (rows.length === 0) {
      await tx
        .update(schema.VisibilityScanState)
        .set({
          afterId: null,
          cycle: sql`${schema.VisibilityScanState.cycle} + 1`,
          lastCompletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.VisibilityScanState.entityType, entityType));
      return { entityType, scanned: 0, queued: 0, wrapped: true };
    }

    let queued = 0;
    let lastQueuedId: string | null = null;
    for (const row of rows) {
      const result = await enqueue({
        type: "visibilityRevalidate",
        entityType,
        entityId: row.id,
      });
      if (!result) break;
      queued += 1;
      lastQueuedId = row.id;
    }

    const wrapped =
      queued === rows.length &&
      rows.length < VISIBILITY_REVALIDATION_BATCH_SIZE;
    if (lastQueuedId !== null || wrapped) {
      await tx
        .update(schema.VisibilityScanState)
        .set({
          afterId: wrapped ? null : lastQueuedId,
          ...(wrapped
            ? {
                cycle: sql`${schema.VisibilityScanState.cycle} + 1`,
                lastCompletedAt: new Date(),
              }
            : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.VisibilityScanState.entityType, entityType),
            state.afterId === null
              ? isNull(schema.VisibilityScanState.afterId)
              : eq(schema.VisibilityScanState.afterId, state.afterId),
          ),
        );
    }

    if (queued < rows.length) {
      logger.warn(
        {
          event: "visibility_scan_backpressure",
          entityType,
          scanned: rows.length,
          queued,
        },
        "Visibility revalidation fan-out stopped at queue capacity",
      );
    }

    return { entityType, scanned: rows.length, queued, wrapped };
  });
}
