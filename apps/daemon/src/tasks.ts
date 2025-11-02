import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  fetchArticle,
  fetchArticleReplies,
  fetchDiscuss,
} from "@luogu-discussion-archive/crawler";
import {
  client,
  STREAM_IMMEDIATE,
  STREAM_ROUTINE,
  type Task,
} from "@luogu-discussion-archive/redis";

import { REPLY_PAGE_CACHE_TTL_SEC } from "./config.js";

const SCRIPT_SET_IF_GREATER = await readFile(
  path.join(import.meta.dirname, "../set_if_greater.lua"),
);

export async function perform(task: Task, stream: string) {
  switch (task.type) {
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
          } satisfies Task);
          break;
        }
      }

      const { numPages, numNewReplies } = await fetchDiscuss(
        parseInt(task.id),
        parseInt(task.page ?? "1"),
      );

      if (!task.page)
        for (let i = numPages; i >= 1; i--) {
          await client.xAdd(STREAM_IMMEDIATE, "*", {
            type: "discuss",
            id: task.id,
            page: String(i),
          } satisfies Task);
        }
      else if (!numNewReplies)
        await client.eval(SCRIPT_SET_IF_GREATER, {
          keys: [noNewRepliesKey],
          arguments: [task.page, "EX", String(REPLY_PAGE_CACHE_TTL_SEC)],
        });

      break;
    }

    case "article":
      await fetchArticle(task.lid);
      await client.xAdd(STREAM_IMMEDIATE, "*", {
        type: "articleReplies",
        lid: task.lid,
      } satisfies Task);
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
          } satisfies Task,
        );

      break;
    }
  }
}
