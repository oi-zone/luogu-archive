import type { FeedEntry, FeedPage } from "@luogu-discussion-archive/query";

export type FeedApiPage = FeedPage;

export async function fetchFeedPage(
  cursor?: string | null,
  signal?: AbortSignal,
): Promise<FeedPage> {
  const params = new URLSearchParams();
  if (cursor) {
    params.set("cursor", cursor);
  }

  const query = params.size > 0 ? `?${params.toString()}` : "";
  const response = await fetch(`/api/feed${query}`, {
    method: "GET",
    signal,
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to load feed entries");
  }

  return (await response.json()) as FeedPage;
}

export type { FeedEntry };
