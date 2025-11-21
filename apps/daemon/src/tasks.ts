import { readFile } from "node:fs/promises";
import path from "node:path";

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
  client,
  STREAM_IMMEDIATE,
  STREAM_ROUTINE,
  type Job,
} from "@luogu-discussion-archive/redis";

import { REPLY_PAGE_CACHE_TTL_SEC } from "./config.js";

const SCRIPT_SET_IF_LT = await readFile(
  path.join(import.meta.dirname, "../set_if_lt.lua"),
);

export async function perform(task: Job, stream: string) {
  switch (task.type) {
    case "listDiscuss": {
      const discussions = await listDiscuss(
        task.forum,
        task.page ? parseInt(task.page) : undefined,
      );
      await Promise.all(
        discussions.map(({ id, replyCount }) =>
          client.xAdd(STREAM_IMMEDIATE, "*", {
            type: "discuss",
            id: String(id),
            page: replyCount
              ? String(Math.ceil(replyCount / REPLIES_PER_PAGE))
              : "1",
          } satisfies Job),
        ),
      );
      break;
    }

    case "listArticles": {
      const articles = await listArticles(
        task.collection ? parseInt(task.collection) : undefined,
        task.page ? parseInt(task.page) : undefined,
      );
      await Promise.all(
        articles.map((lid) =>
          client.xAdd(STREAM_IMMEDIATE, "*", {
            type: "article",
            lid,
          } satisfies Job),
        ),
      );
      break;
    }

    case "discuss": {
      const id = task.id,
        page = task.page ? parseInt(task.page) : undefined;

      const {
        numPages,
        numReplies,
        numNewReplies,
        recentReply,
        recentReplySnapshot,
      } = await fetchDiscuss(parseInt(id), page);

      if (page && recentReply && !recentReplySnapshot)
        await client.xAdd(STREAM_IMMEDIATE, "*", {
          type: "discuss",
          id,
          page: String(numPages),
        } satisfies Job);

      if (numPages > 1) {
        const prevPage = page ? page - 1 : numPages;
        if (prevPage < 1) break;

        const keyRecentlySavedPage = `crawler:recent:discuss:${task.id}`;
        const notRecentlySaved = await client.eval(SCRIPT_SET_IF_LT, {
          keys: [keyRecentlySavedPage],
          arguments: [String(prevPage), "EX", String(REPLY_PAGE_CACHE_TTL_SEC)],
        });

        const streamToUse =
          page && numNewReplies < numReplies ? STREAM_ROUTINE : stream;
        if (streamToUse === STREAM_IMMEDIATE || notRecentlySaved)
          await client.xAdd(streamToUse, "*", {
            type: "discuss",
            id,
            page: String(prevPage),
          } satisfies Job);
      }

      break;
    }

    case "article":
      await fetchArticle(task.lid);
      await client.xAdd(STREAM_IMMEDIATE, "*", {
        type: "articleReplies",
        lid: task.lid,
      } satisfies Job);
      break;

    case "articleReplies": {
      const { lastReplyId, lastReplySaved } = await fetchArticleReplies(
        task.lid,
        task.after ? parseInt(task.after) : undefined,
      );

      if (lastReplyId)
        await client.xAdd(
          lastReplySaved ? STREAM_ROUTINE : STREAM_IMMEDIATE,
          "*",
          {
            type: "articleReplies",
            lid: task.lid,
            after: String(lastReplyId),
          } satisfies Job,
        );

      await new Promise((resolve) =>
        setTimeout(resolve, (1 + Math.random()) * 1000),
      );
      break;
    }

    case "paste":
      await fetchPaste(task.id);
      break;

    case "judgement":
      await fetchJudgement();
      break;
  }
}
