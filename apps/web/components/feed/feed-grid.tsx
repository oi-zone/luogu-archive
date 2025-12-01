"use client";

import * as React from "react";
import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import type { FeedEntry, FeedPage } from "@luogu-discussion-archive/query";

import { fetchFeedPage } from "@/lib/feed-client";
import { Button } from "@/components/ui/button";

import { FeedCard } from "./feed-item";

const FEED_QUERY_KEY = ["feed" as const];
const FETCH_MORE_LIMIT = 20;
const DEFAULT_COLUMN_COUNT = 1;

export type FeedGridProps = {
  initialPage: FeedPage;
};

export function FeedGrid({ initialPage }: FeedGridProps) {
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  const columnCount = useResponsiveColumnCount();
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isPending,
    refetch,
  } = useInfiniteQuery<
    FeedPage,
    Error,
    InfiniteData<FeedPage, string | null>,
    typeof FEED_QUERY_KEY,
    string | null
  >({
    queryKey: FEED_QUERY_KEY,
    queryFn: ({ pageParam }) =>
      fetchFeedPage({
        cursor: typeof pageParam === "string" ? pageParam : null,
        limit: FETCH_MORE_LIMIT,
      }),
    initialPageParam: null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
    initialData: {
      pages: [initialPage],
      pageParams: [null],
    },
  });

  const items = React.useMemo<FeedEntry[]>(() => {
    const aggregated = data
      ? data.pages.flatMap((page) => page.items)
      : initialPage.items;
    const unique: FeedEntry[] = [];
    const seen = new Set<string>();
    for (const entry of aggregated) {
      if (seen.has(entry.key)) continue;
      seen.add(entry.key);
      unique.push(entry);
    }
    return unique;
  }, [data, initialPage]);

  const handleManualLoad = React.useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  const columns = React.useMemo(() => {
    const bucketCount = Math.max(DEFAULT_COLUMN_COUNT, columnCount);
    const buckets: FeedEntry[][] = Array.from(
      { length: bucketCount },
      () => [],
    );
    items.forEach((entry, index) => {
      buckets[index % bucketCount].push(entry);
    });
    return buckets;
  }, [items, columnCount]);

  React.useEffect(() => {
    if (!hasNextPage) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "600px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const showInitialLoading = isPending && items.length === 0;
  const showEmpty = !isPending && items.length === 0;
  const errorMessage = isError
    ? (error?.message ?? "加载首页失败，请稍后重试")
    : null;

  if (showInitialLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        正在载入首页内容
      </div>
    );
  }

  if (showEmpty) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 px-6 py-10 text-center text-sm text-muted-foreground">
        暂无可展示的内容
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div
        className="grid gap-6"
        style={{
          gridTemplateColumns: `repeat(${Math.max(DEFAULT_COLUMN_COUNT, columnCount)}, minmax(0, 1fr))`,
        }}
      >
        {columns.map((columnItems, columnIndex) => (
          <div
            key={`feed-column-${columnIndex}`}
            className="flex flex-col gap-6"
          >
            {columnItems.map((item) => (
              <FeedCard key={item.key} item={item} />
            ))}
          </div>
        ))}
      </div>

      <div
        ref={sentinelRef}
        className="flex flex-col items-center gap-3 py-6 text-sm text-muted-foreground"
      >
        {isFetchingNextPage ? (
          <>
            <Loader2 className="size-5 animate-spin" aria-hidden />
            <span>载入更多内容…</span>
          </>
        ) : hasNextPage ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualLoad}
            disabled={isFetchingNextPage}
          >
            加载更多
          </Button>
        ) : (
          <span>没有更多了</span>
        )}
        {errorMessage ? (
          <div className="flex flex-col items-center gap-2 text-xs text-destructive">
            <span>{errorMessage}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              重试
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function useResponsiveColumnCount() {
  const [count, setCount] = React.useState(DEFAULT_COLUMN_COUNT);

  React.useEffect(() => {
    function resolveCount(width: number) {
      if (width >= 2000) return 5;
      if (width >= 1600) return 4;
      if (width >= 1200) return 3;
      if (width >= 800) return 2;
      return DEFAULT_COLUMN_COUNT;
    }

    function update() {
      setCount(resolveCount(window.innerWidth));
    }

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return count;
}
