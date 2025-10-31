import { createClientPool, type RedisClientPoolType } from "redis";

export { STREAM_KEY } from "./keys.js";

export const client: RedisClientPoolType = createClientPool();

export type Task =
  | { type: "discuss"; id: string; page?: string }
  | { type: "paste"; id: string };
