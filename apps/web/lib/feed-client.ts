import type { FeedEntry, FeedPage } from "@luogu-discussion-archive/query";

export type FeedApiPage = FeedPage;

type FetchFeedOptions = {
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
};

export async function fetchFeedPage({
  cursor,
  limit,
  signal,
}: FetchFeedOptions = {}): Promise<FeedPage> {
  const params = new URLSearchParams();
  if (cursor) {
    params.set("cursor", cursor);
  }
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    params.set("limit", Math.floor(limit).toString());
  }

  const query = params.size > 0 ? `?${params.toString()}` : "";
  const response = await fetch(`/api/feed${query}`, {
    method: "GET",
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("首页内容加载失败，请稍后重试");
  }

  return (await response.json()) as FeedPage;
}

export type { FeedEntry };
