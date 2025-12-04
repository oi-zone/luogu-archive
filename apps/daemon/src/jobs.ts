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
import { queueJob, Stream, type Job } from "@luogu-discussion-archive/redis";
import { setIfLt } from "@luogu-discussion-archive/redis/utils";

import { REPLY_PAGE_CACHE_TTL_SEC } from "./config.js";

export async function execute(job: Job, stream: Stream) {
  switch (job.type) {
    case "listDiscuss": {
      const discussions = await listDiscuss(
        job.forum,
        job.page ? parseInt(job.page) : undefined,
      );
      await Promise.all(
        discussions.map(({ id, replyCount }) =>
          queueJob(
            {
              type: "discuss",
              id: String(id),
              page: replyCount
                ? String(Math.ceil(replyCount / REPLIES_PER_PAGE))
                : "1",
            },
            stream,
          ),
        ),
      );
      break;
    }

    case "listArticles": {
      const articles = await listArticles(
        job.collection ? parseInt(job.collection) : undefined,
        job.page ? parseInt(job.page) : undefined,
      );
      await Promise.all(
        articles.map((lid) => queueJob({ type: "article", lid }, stream)),
      );
      break;
    }

    case "discuss": {
      const id = job.id,
        page = job.page ? parseInt(job.page) : undefined;

      const {
        numPages,
        numReplies,
        numNewReplies,
        recentReply,
        recentReplySnapshot,
      } = await fetchDiscuss(parseInt(id), page);

      if (page && recentReply && !recentReplySnapshot)
        await queueJob({ type: "discuss", id, page: String(numPages) });

      if (numPages > 1) {
        const prevPage = page ? page - 1 : numPages;
        if (prevPage < 1) break;

        const keyRecentlySavedPage = `crawler:recent:discuss:${job.id}`;
        const notRecentlySaved = await setIfLt(
          keyRecentlySavedPage,
          String(prevPage),
          "EX",
          String(REPLY_PAGE_CACHE_TTL_SEC),
        );

        const streamToUse =
          page && numNewReplies < numReplies ? Stream.Routine : stream;
        if (streamToUse === Stream.Immediate || notRecentlySaved)
          await queueJob(
            { type: "discuss", id, page: String(prevPage) },
            streamToUse,
          );
      }

      break;
    }

    case "article":
      await fetchArticle(job.lid);
      await queueJob({ type: "articleReplies", lid: job.lid }, stream);
      break;

    case "articleReplies": {
      const { lastReplyId, lastReplySaved } = await fetchArticleReplies(
        job.lid,
        job.after ? parseInt(job.after) : undefined,
      );

      if (lastReplyId)
        await queueJob(
          { type: "articleReplies", lid: job.lid, after: String(lastReplyId) },
          lastReplySaved ? Stream.Routine : stream,
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
