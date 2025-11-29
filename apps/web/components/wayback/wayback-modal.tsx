"use client";

import * as React from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";

import { ABSOLUTE_DATE_FORMATTER, formatRelativeTime } from "@/lib/feed-data";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const DEFAULT_HASH = "#wayback";

export type WaybackBadge = {
  key: string;
  label: string;
  className?: string;
};

export type WaybackTimelineItem = {
  snapshotId: string;
  title: string;
  capturedAt: string;
  lastSeenAt?: string | null;
  badges?: WaybackBadge[];
  meta?: React.ReactNode[];
};

export type WaybackFetchResult<T extends WaybackTimelineItem> = {
  items: T[];
  hasMore: boolean;
  nextCursor: string | null;
};

export type WaybackDataSource<T extends WaybackTimelineItem> = {
  key: readonly unknown[] | string;
  fetchPage: (params: {
    cursor?: string | null;
  }) => Promise<WaybackFetchResult<T>>;
};

type WaybackModalProps<T extends WaybackTimelineItem> = {
  dataSource: WaybackDataSource<T>;
  enabled?: boolean;
  hash?: string;
  targetSnapshotId?: string | null;
  onSelectSnapshot?: (item: T) => void;
  header?: {
    title: string;
    description?: string;
  };
  emptyMessage?: React.ReactNode;
  loadingMessage?: React.ReactNode;
  errorMessage?: React.ReactNode;
};

export function WaybackModal<T extends WaybackTimelineItem>(
  props: WaybackModalProps<T>,
) {
  const {
    dataSource,
    enabled = true,
    hash = DEFAULT_HASH,
    targetSnapshotId = null,
    onSelectSnapshot,
    header,
    emptyMessage = "暂无快照记录。",
    loadingMessage = "正在加载历史快照…",
    errorMessage = "加载失败",
  } = props;

  const [isOpen, setIsOpen] = React.useState(false);
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);

  const openHash = hash;
  const keyParts = React.useMemo(
    () => (Array.isArray(dataSource.key) ? dataSource.key : [dataSource.key]),
    [dataSource.key],
  );

  const handleHashChange = React.useCallback(() => {
    if (typeof window === "undefined") return;
    if (!enabled) {
      setIsOpen(false);
      return;
    }
    setIsOpen(window.location.hash === openHash);
  }, [enabled, openHash]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [handleHashChange]);

  const close = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const baseUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, "", baseUrl);
    setIsOpen(false);
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    closeButtonRef.current?.focus();
  }, [isOpen]);

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["wayback", ...keyParts],
    queryFn: ({ pageParam }) =>
      dataSource.fetchPage({
        cursor: typeof pageParam === "string" ? pageParam : null,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
    enabled: isOpen && enabled,
    staleTime: 0,
  });

  const timelineItems = React.useMemo(() => {
    if (!data) return [] as T[];
    return data.pages.flatMap((page) => page.items);
  }, [data]);

  const activeSnapshotId =
    targetSnapshotId ?? timelineItems[0]?.snapshotId ?? null;

  React.useEffect(() => {
    if (!isOpen) return;
    if (!targetSnapshotId) return;
    if (!hasNextPage || isFetchingNextPage) return;
    if (timelineItems.length === 0) return;
    const exists = timelineItems.some(
      (item) => item.snapshotId === targetSnapshotId,
    );
    if (!exists) {
      void fetchNextPage();
    }
  }, [
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isOpen,
    targetSnapshotId,
    timelineItems,
  ]);

  const handleItemSelect = React.useCallback(
    (item: T) => {
      close();
      onSelectSnapshot?.(item);
    },
    [close, onSelectSnapshot],
  );

  if (!isOpen) {
    return null;
  }

  const timelineContent = (() => {
    if (isPending) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          {loadingMessage}
        </div>
      );
    }

    if (isError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-destructive/90">
          <p>{error instanceof Error ? error.message : errorMessage}</p>
          <Button
            variant="outline"
            type="button"
            onClick={() => void refetch()}
          >
            重试
          </Button>
        </div>
      );
    }

    if (timelineItems.length === 0) {
      return (
        <div className="flex h-full flex-col items-center justify-center text-sm text-muted-foreground/80">
          {emptyMessage}
        </div>
      );
    }

    return (
      <ol className="relative space-y-6">
        {timelineItems.map((item) => {
          const capturedAt = new Date(item.capturedAt);
          const isActive = activeSnapshotId === item.snapshotId;

          return (
            <li key={item.snapshotId} className="relative">
              <button
                type="button"
                className={cn(
                  "group border bg-card/70 text-left transition-all hover:bg-muted",
                  "w-full rounded-3xl border-border/70 px-5 py-4 backdrop-blur-sm",
                  isActive && "bg-muted",
                )}
                onClick={() => handleItemSelect(item)}
                aria-current={isActive ? "true" : undefined}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex flex-wrap items-center gap-2">
                    <time
                      className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                      dateTime={item.capturedAt}
                    >
                      {ABSOLUTE_DATE_FORMATTER.format(capturedAt)} ·{" "}
                      {formatRelativeTime(capturedAt)}
                    </time>

                    {item.badges && item.badges.length > 0 ? (
                      <div className="-mt-0.75 flex inline-block flex-wrap gap-1.5">
                        {item.badges.map((badge) => (
                          <Badge
                            key={badge.key}
                            className={cn(
                              "bg-muted/70 text-muted-foreground",
                              "border border-border/50",
                              badge.className,
                            )}
                          >
                            {badge.label}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {isActive ? (
                    <Badge className="bg-primary/15 text-primary">
                      当前查看
                    </Badge>
                  ) : null}
                </div>

                {item.title && (
                  <p className="mt-3 text-base leading-relaxed font-semibold text-foreground">
                    {item.title}
                  </p>
                )}

                {item.meta && item.meta.length > 0 ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground/90">
                    {item.meta.map((meta, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1"
                      >
                        {meta}
                      </span>
                    ))}
                  </div>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
    );
  })();

  const headerTitle = header?.title ?? "时光机";
  const headerDescription =
    header?.description ?? "翻阅历史快照，观察内容的演变。";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm sm:p-8"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="时光机"
        className="relative flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-border bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="relative flex items-start gap-3 border-b border-border/70 px-6 py-5">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">
              {headerTitle}
            </h2>
            {headerDescription ? (
              <p className="text-sm text-muted-foreground">
                {headerDescription}
              </p>
            ) : null}
          </div>
          <Button
            ref={closeButtonRef}
            variant="ghost"
            size="icon-sm"
            type="button"
            className="absolute top-4 right-4 rounded-full"
            onClick={close}
          >
            <X className="size-4" aria-hidden="true" />
            <span className="sr-only">关闭时光机</span>
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          {timelineContent}
        </div>

        {hasNextPage ? (
          <div className="flex items-center justify-center border-t border-border/70 bg-background/95 px-6 py-4">
            <Button
              variant="outline"
              type="button"
              disabled={isFetchingNextPage}
              onClick={() => void fetchNextPage()}
              className="rounded-xl"
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  加载中…
                </>
              ) : (
                "加载更多"
              )}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
