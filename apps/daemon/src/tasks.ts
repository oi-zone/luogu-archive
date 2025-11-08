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
} from "@luogu-discussion-archive/crawler";
import {
  client,
  STREAM_IMMEDIATE,
  STREAM_ROUTINE,
  type Job,
} from "@luogu-discussion-archive/redis";

import { REPLY_PAGE_CACHE_TTL_SEC } from "./config.js";

const SCRIPT_SET_IF_GREATER = await readFile(
  path.join(import.meta.dirname, "../set_if_greater.lua"),
);

export async function perform(task: Job, stream: string) {
  switch (task.type) {
    case "listDiscuss": {
      const discussions = await listDiscuss(
        task.forum,
        task.page ? parseInt(task.page) : undefined,
      );
      await Promise.all(
        discussions.map((id) =>
          client.xAdd(STREAM_IMMEDIATE, "*", {
            type: "discuss",
            id: String(id),
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
      const noNewRepliesKey = `discuss.no-new-replies.${task.id}`;
      if (task.page && stream !== STREAM_ROUTINE) {
        const noNewRepliesPage = parseInt(
          (await client.get(noNewRepliesKey)) ?? "0",
        );
        if (parseInt(task.page) <= noNewRepliesPage) {
          await client.xAdd(STREAM_ROUTINE, "*", {
            type: "discuss",
            id: task.id,
            page: String(parseInt(task.page)),
          } satisfies Job);
          break;
        }
      }

      const { numPages, numReplies, numNewReplies } = await fetchDiscuss(
        parseInt(task.id),
        parseInt(task.page ?? "1"),
      );

      if (!task.page && numPages > 1)
        for (let i = numPages; i >= 1; i--) {
          await client.xAdd(STREAM_IMMEDIATE, "*", {
            type: "discuss",
            id: task.id,
            page: String(i),
          } satisfies Job);
        }
      else if (numNewReplies < numReplies)
        await client.eval(SCRIPT_SET_IF_GREATER, {
          keys: [noNewRepliesKey],
          arguments: [task.page ?? "1", "EX", String(REPLY_PAGE_CACHE_TTL_SEC)],
        });

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
