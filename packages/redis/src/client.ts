import { createClientPool, type RedisClientPoolType } from "redis";

import logger from "@luogu-discussion-archive/logging";

export const client: RedisClientPoolType = createClientPool();
client.on("error", (err) => {
  logger.error({ err }, "Redis client error");
});
