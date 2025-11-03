import { createClientPool, type RedisClientPoolType } from "redis";

import logger from "@luogu-discussion-archive/logging";

export { STREAM_IMMEDIATE, STREAM_ROUTINE } from "./keys.js";

export const client: RedisClientPoolType = createClientPool();
client.on("error", (err) => {
  logger.error({ err }, "Redis client error");
});

export type Job =
  | { type: "discuss"; id: string; page?: string }
  | { type: "article"; lid: string }
  | { type: "articleReplies"; lid: string; after?: string }
  | { type: "paste"; id: string }
  | { type: "judgement" };
