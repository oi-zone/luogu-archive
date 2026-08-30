import {
  AccessError,
  fetchArticle,
  fetchArticleReplies,
  fetchDiscuss,
  fetchJudgement,
  fetchPaste,
  listArticles,
  listDiscuss,
  REPLIES_PER_PAGE,
} from "@luogu-discussion-archive/crawler";
import logger from "@luogu-discussion-archive/logging";
import {
  boundedInteger,
  queueRefreshJob,
  type BackfillJob,
  type RefreshJob,
} from "@luogu-discussion-archive/queue";

import {
  articleRepliesNextCursor,
  discussionNextCursor,
} from "./backfill-policy.js";
import {
  advanceBackfill,
  claimBackfill,
  ensureBackfill,
  pauseBackfill,
  releaseBackfill,
} from "./backfill.js";

const MAX_BACKFILL_PAGES_PER_ENTITY = boundedInteger(
  "BACKFILL_MAX_PAGES_PER_ENTITY",
  1_000,
  1,
  100_000,
);
let lastRefreshBackpressureWarningAt = 0;

async function enqueueRefresh(job: RefreshJob) {
  const queued = await queueRefreshJob(job);
  if (queued) return queued;
  const now = Date.now();
  if (now - lastRefreshBackpressureWarningAt >= 60_000) {
    lastRefreshBackpressureWarningAt = now;
    logger.warn(
      { event: "queue_backpressure", queue: "refresh", jobType: job.type },
      "Refresh fan-out paused at configured queue depth",
    );
  }
  return null;
}

export async function processRefreshJob(job: RefreshJob) {
  switch (job.type) {
    case "listDiscuss": {
      const discussions = await listDiscuss(job.forum, job.page);
      for (const { id, replyCount } of discussions) {
        const queued = await enqueueRefresh({
          type: "discuss",
          id,
          page: replyCount ? Math.ceil(replyCount / REPLIES_PER_PAGE) : 1,
        });
        if (!queued) break;
      }
      break;
    }

    case "listArticles": {
      const articles = await listArticles(
        job.collection ? parseInt(job.collection) : undefined,
        job.page,
      );
      for (const lid of articles) {
        if (!(await enqueueRefresh({ type: "article", lid }))) break;
      }
      break;
    }

    case "discuss": {
      const id = job.id,
        page = job.page;

      const result = await fetchDiscuss(id, page);

      if (result.numPages > 0 && page !== result.numPages) {
        await enqueueRefresh({
          type: "discuss",
          id,
          page: result.numPages,
          ...(job.reopenBackfill ? { reopenBackfill: true } : {}),
        });
        break;
      }

      await ensureBackfill({
        entityType: "discussionReplies",
        entityId: String(id),
        initialCursor: result.numPages > 1 ? String(result.numPages - 1) : null,
        ...(job.reopenBackfill ? { reopen: true } : {}),
      });

      break;
    }

    case "article": {
      await fetchArticle(job.lid);
      const replies = await fetchArticleReplies(job.lid);
      const initialCursor =
        replies.lastReplyId && (!replies.lastReplySaved || job.reopenBackfill)
          ? String(replies.lastReplyId)
          : null;
      await ensureBackfill({
        entityType: "articleReplies",
        entityId: job.lid,
        initialCursor,
        ...(job.reopenBackfill ? { reopen: true } : {}),
      });
      break;
    }

    case "paste":
      await fetchPaste(job.id);
      break;

    case "judgement":
      await fetchJudgement();
      break;
  }
}

export async function processBackfillJob(job: BackfillJob) {
  const cursor = await claimBackfill(job);
  if (!cursor) return;

  try {
    if (job.entityType === "discussionReplies") {
      const id = Number(job.entityId);
      const page = Number(job.cursor);
      if (
        !Number.isSafeInteger(id) ||
        id <= 0 ||
        !Number.isSafeInteger(page) ||
        page <= 0
      ) {
        throw new Error("Invalid persisted discussion backfill cursor");
      }

      const result = await fetchDiscuss(id, page);
      await advanceBackfill(
        job,
        discussionNextCursor({
          page,
          numReplies: result.numReplies,
          numNewReplies: result.numNewReplies,
          pagesProcessed: cursor.pagesProcessed,
          maximumPages: MAX_BACKFILL_PAGES_PER_ENTITY,
        }),
      );
      return;
    }

    const after = Number(job.cursor);
    if (!Number.isSafeInteger(after) || after <= 0) {
      throw new Error("Invalid persisted article reply cursor");
    }
    const result = await fetchArticleReplies(job.entityId, after);
    await advanceBackfill(
      job,
      articleRepliesNextCursor({
        lastReplyId: result.lastReplyId,
        lastReplySaved: Boolean(result.lastReplySaved),
        replyCount: result.replyCount,
        newReplyCount: result.newReplyCount,
        pagesProcessed: cursor.pagesProcessed,
        maximumPages: MAX_BACKFILL_PAGES_PER_ENTITY,
      }),
    );
  } catch (error) {
    if (error instanceof AccessError) await pauseBackfill(job, error);
    else await releaseBackfill(job, error);
    throw error;
  }
}
