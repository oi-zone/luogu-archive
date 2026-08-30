import DataLoader from "dataloader";

import { Entry, EntryRef } from "@luogu-discussion-archive/query";

async function fetchEntriesBatch(
  refs: readonly EntryRef[],
): Promise<(Entry | Error)[]> {
  const params = new URLSearchParams();
  for (const ref of refs) params.append("entry-ref", `${ref.type}:${ref.id}`);

  const response = await fetch(`/api/entries?${params.toString()}`);
  if (!response.ok) throw new Error("Failed to load linked archive entries");
  return response.json();
}

export const entryLoader = new DataLoader<EntryRef, Entry>(fetchEntriesBatch, {
  cache: false,
  maxBatchSize: 100,
});
