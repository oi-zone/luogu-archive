import { createClientPool, type RedisClientPoolType } from "redis";

export { STREAM_IMMEDIATE, STREAM_ROUTINE } from "./keys.js";

export const client: RedisClientPoolType = createClientPool();

export type Task =
  | { type: "discuss"; id: string; page?: string }
  | { type: "article"; lid: string };
