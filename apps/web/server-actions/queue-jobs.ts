"use server";

import { queueJob } from "@luogu-discussion-archive/queue";

export async function enqueueArticleRefresh(lid: string) {
  await queueJob({ type: "article", lid });
}

export async function enqueueDiscussionRefresh(id: number) {
  await queueJob({ type: "discuss", id });
}

export async function enqueuePasteRefresh(id: string) {
  await queueJob({ type: "paste", id });
}

export async function enqueueJudgementRefresh() {
  await queueJob({ type: "judgement" });
}
