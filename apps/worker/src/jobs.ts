import {
  fetchArticle,
  fetchArticleReplies,
  fetchDiscuss,
  fetchJudgement,
  fetchPaste,
  listArticles,
  listDiscuss,
  REPLIES_PER_PAGE,
} from "@luogu-discussion-archive/crawler";
import {
  BACKFILL_PRIORITY,
  queueJob,
  type Job,
} from "@luogu-discussion-archive/queue";

export async function processJob(job: Job, priority?: number) {
  switch (job.type) {
    case "listDiscuss": {
      const discussions = await listDiscuss(job.forum, job.page);
      await Promise.all(
        discussions.map(({ id, replyCount }) =>
          queueJob(
            {
              type: "discuss",
              id: id,
              page: replyCount ? Math.ceil(replyCount / REPLIES_PER_PAGE) : 1,
            },
            priority,
          ),
        ),
      );
      break;
    }

    case "listArticles": {
      const articles = await listArticles(
        job.collection ? parseInt(job.collection) : undefined,
        job.page,
      );
      await Promise.all(
        articles.map((lid) => queueJob({ type: "article", lid }, priority)),
      );
      break;
    }

    case "discuss": {
      const id = job.id,
        page = job.page;

      const {
        numPages,
        numReplies,
        numNewReplies,
        recentReply,
        recentReplySnapshot,
      } = await fetchDiscuss(id, page);

      if (recentReply && !recentReplySnapshot)
        await queueJob({ type: "discuss", id, page: numPages });

      if (numPages && page && page > 1)
        await queueJob(
          { type: "discuss", id, page: Math.min(page - 1, numPages) },
          numNewReplies < numReplies ? BACKFILL_PRIORITY : priority,
        );

      break;
    }

    case "article":
      await fetchArticle(job.lid);
      await queueJob({ type: "articleReplies", lid: job.lid }, priority);
      break;

    case "articleReplies": {
      const { lastReplyId, lastReplySaved } = await fetchArticleReplies(
        job.lid,
        job.after,
      );

      if (lastReplyId)
        await queueJob(
          { type: "articleReplies", lid: job.lid, after: lastReplyId },
          lastReplySaved ? BACKFILL_PRIORITY : priority,
        );

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
