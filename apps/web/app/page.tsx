"use client";

import * as React from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Loader2, TriangleAlert } from "lucide-react";

import { fetchFeedPage } from "@/lib/feed-client";
import { Button } from "@/components/ui/button";
import { FeedCard } from "@/components/feed-cards/feed-card";

export default function Page() {
  return (
    <div className="flex flex-1 flex-col gap-8 px-6 pt-8 pb-12">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">社区精选</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              实时更新的文章、讨论与动态，跟进社区的每一次灵感。
            </p>
          </div>
        </div>
      </div>
      <FeedTimeline />
    </div>
  );
}

function FeedTimeline() {
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  const {
    data,
    status,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["home-feed"],
    queryFn: ({ signal, pageParam }) =>
      fetchFeedPage(pageParam ?? null, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
    staleTime: 30_000,
  });

  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const errorMessage = error instanceof Error ? error.message : "请稍后再试";

  React.useEffect(() => {
    if (!hasNextPage) {
      return undefined;
    }
    const node = sentinelRef.current;
    if (!node) {
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "720px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (status === "pending") {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card/40 py-16 text-center text-sm text-muted-foreground">
        <TriangleAlert className="size-10 text-amber-500" />
        <div>
          <p className="text-lg font-medium text-foreground">加载失败</p>
          <p className="mt-1">{errorMessage}</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          重试
        </Button>
      </div>
    );
  }

  return (
    <>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border py-16 text-sm text-muted-foreground">
          <p>暂时没有新的内容，稍后再来看看吧。</p>
        </div>
      ) : (
        <div className="columns-1 gap-6 [column-fill:_balance] sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5">
          {items.map((item) => (
            <FeedCard key={`${item.type}-${item.id}`} item={item} />
          ))}
        </div>
      )}
      <div ref={sentinelRef} className="flex justify-center py-6">
        {hasNextPage ? (
          isFetchingNextPage ? (
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          ) : (
            <span className="text-xs text-muted-foreground">
              向下滚动以加载更多
            </span>
          )
        ) : (
          <span className="text-xs text-muted-foreground/70">已经到底了</span>
        )}
      </div>
    </>
  );
}
