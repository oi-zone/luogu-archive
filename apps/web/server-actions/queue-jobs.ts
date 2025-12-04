"use server";

import { queueJob } from "@luogu-discussion-archive/redis";

export async function enqueueArticleRefresh(lid: string) {
  await queueJob({ type: "article", lid });
}

export async function enqueueDiscussionRefresh(id: number | string) {
  await queueJob({ type: "discuss", id: String(id) });
}

export async function enqueuePasteRefresh(id: string) {
  await queueJob({ type: "paste", id });
}
