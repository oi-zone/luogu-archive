"use client";

import * as React from "react";
import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import { Gavel, Link as LinkIcon, Loader2 } from "lucide-react";
import Link from "next/link";

import { getPermissionNames } from "@/lib/judgement";
import type { OstrakonEntry, OstrakonPage } from "@/lib/ostrakon-shared";
import { ABSOLUTE_DATE_FORMATTER, formatRelativeTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import UserInlineLink from "@/components/user/user-inline-link";

const TONE_STYLES = {
  green: {
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    cardClass: "border-emerald-500/40 bg-emerald-500/5",
    titleClass: "text-emerald-600 dark:text-emerald-200",
    bodyClass: "text-emerald-600/80 dark:text-emerald-200/80",
  },
  yellow: {
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    cardClass: "border-amber-500/40 bg-amber-500/5",
    titleClass: "text-amber-600 dark:text-amber-200",
    bodyClass: "text-amber-600/80 dark:text-amber-200/80",
  },
  red: {
    badgeClass: "bg-red-500/10 text-red-600 dark:text-red-300",
    cardClass: "border-red-500/40 bg-red-500/5",
    titleClass: "text-red-600 dark:text-red-200",
    bodyClass: "text-red-600/80 dark:text-red-200/80",
  },
} as const;

type Tone = keyof typeof TONE_STYLES;
type ToneStyle = (typeof TONE_STYLES)[Tone];

type OstrakaTimelineProps = {
  initialEntries: OstrakonEntry[];
  initialHasMore: boolean;
  initialCursor: string | null;
};

export function OstrakaTimeline({
  initialEntries,
  initialHasMore,
  initialCursor,
}: OstrakaTimelineProps) {
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
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
    OstrakonPage,
    Error,
    InfiniteData<OstrakonPage, string | null>,
    ["ostraka"],
    string | null
  >({
    queryKey: ["ostraka"],
    queryFn: ({ pageParam }) =>
      fetchOstrakaPage(typeof pageParam === "string" ? pageParam : null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
    initialData: {
      pages: [
        {
          entries: initialEntries,
          hasMore: initialHasMore,
          nextCursor: initialCursor,
        },
      ],
      pageParams: [null],
    } satisfies InfiniteData<OstrakonPage, string | null>,
  });

  const entries = React.useMemo(() => {
    if (!data) return initialEntries;
    return data.pages.flatMap((page) => page.entries);
  }, [data, initialEntries]);

  const handleManualLoad = React.useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  React.useEffect(() => {
    if (!hasNextPage) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (records) => {
        const [{ isIntersecting }] = records;
        if (isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "600px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const isEmpty = !isPending && entries.length === 0;
  const showLoading = isPending && entries.length === 0;
  const errorMessage = isError
    ? error instanceof Error
      ? error.message
      : "加载失败"
    : null;

  return (
    <section className="space-y-6">
      {showLoading ? (
        <Placeholder message="正在加载陶片放逐" />
      ) : isEmpty ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {entries.map((entry) => (
            <OstrakonCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      <div
        ref={sentinelRef}
        className="flex flex-col items-center gap-3 py-6 text-sm text-muted-foreground"
      >
        {isFetchingNextPage ? (
          <>
            <Loader2 className="size-5 animate-spin" aria-hidden />
            <span>载入更多放逐记录…</span>
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
          <span>已经是最早的记录了</span>
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
    </section>
  );
}

function OstrakonCard({ entry }: { entry: OstrakonEntry }) {
  const createdAt = new Date(entry.createdAt);
  const relative = formatRelativeTime(createdAt);
  const style = resolveTone(entry);
  return (
    <article
      id={entry.anchor}
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-sm",
        style.cardClass,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex gap-x-3 gap-y-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
                style.badgeClass,
              )}
            >
              <Gavel className="size-3.5" aria-hidden />
              陶片放逐
            </span>
            {entry.user ? (
              <UserInlineLink user={entry.user} avatar />
            ) : (
              <span className="text-sm text-muted-foreground">未知用户</span>
            )}
          </span>
          <Link
            href={`#${entry.anchor}`}
            scroll={false}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            style={{ display: "none" }}
          >
            <LinkIcon className="size-3.5" aria-hidden />#{entry.anchor}
          </Link>
        </div>
        <time
          className="text-xs text-muted-foreground"
          dateTime={entry.createdAt}
        >
          {ABSOLUTE_DATE_FORMATTER.format(createdAt)} · {relative}
        </time>
      </div>

      <div className="mt-4 space-y-3">
        <div className={cn("text-base font-semibold", style.titleClass)}>
          <ul>
            {getPermissionNames(entry.addedPermission).map((name) => (
              <li key={name}>
                授予 <code>{name}</code> 权限
              </li>
            ))}
            {getPermissionNames(entry.revokedPermission).map((name) => (
              <li key={name}>
                撤销 <code>{name}</code> 权限
              </li>
            ))}
          </ul>
        </div>
        <p className={cn("leading-relaxed", style.bodyClass)}>{entry.reason}</p>
      </div>
    </article>
  );
}

function Placeholder({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-sm text-muted-foreground">
      <Loader2 className="size-6 animate-spin" aria-hidden />
      {message}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-border/60 px-6 py-16 text-center text-sm text-muted-foreground">
      暂无陶片记录。
    </div>
  );
}

function resolveTone(entry: OstrakonEntry): ToneStyle {
  const tone: Tone = entry.hasAddedPermission
    ? entry.hasRevokedPermission
      ? "yellow"
      : "green"
    : "red";
  return TONE_STYLES[tone];
}

async function fetchOstrakaPage(cursor: string | null) {
  const params = new URLSearchParams();
  if (cursor) {
    params.set("cursor", cursor);
  }
  const search = params.toString();
  const response = await fetch(`/api/ostraka${search ? `?${search}` : ""}`);
  if (!response.ok) {
    throw new Error("陶片放逐加载失败");
  }
  return (await response.json()) as OstrakonPage;
}
