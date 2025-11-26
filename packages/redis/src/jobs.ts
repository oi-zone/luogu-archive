import { client } from "./client.js";
import { Stream } from "./stream.js";

export type Job =
  | { type: "listDiscuss"; forum?: string; page?: string }
  | { type: "listArticles"; collection?: string; page?: string }
  | { type: "discuss"; id: string; page?: string }
  | { type: "article"; lid: string }
  | { type: "articleReplies"; lid: string; after?: string }
  | { type: "paste"; id: string }
  | { type: "judgement" };

export const queueJob = (job: Job, stream: Stream = Stream.Immediate) =>
  client.xAdd(stream, "*", job);
