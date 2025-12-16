"use client";

import * as React from "react";
import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import {
  ClipboardList,
  Gavel,
  Loader2,
  MessageCircle,
  MessageSquare,
  MessagesSquare,
  Newspaper,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { getPermissionNames } from "@/lib/judgement";
import { formatRelativeTime } from "@/lib/time";
import type { TimelineEntry } from "@/lib/user-profile-shared";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const TIMELINE_META: Record<
  TimelineEntry["type"],
  {
    label: string;
    icon: LucideIcon;
    badgeClass: string;
    dotClass: string;
  }
> = {
  article: {
    label: "发布文章",
    icon: Newspaper,
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
    dotClass: "bg-sky-500",
  },
  discussion: {
    label: "发起讨论",
    icon: MessagesSquare,
    badgeClass: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    dotClass: "bg-violet-500",
  },
  articleComment: {
    label: "评论文章",
    icon: MessageCircle,
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
  },
  discussionReply: {
    label: "回复讨论",
    icon: MessageSquare,
    badgeClass: "bg-orange-500/10 text-orange-600 dark:text-orange-300",
    dotClass: "bg-orange-500",
  },
  paste: {
    label: "创建云剪贴板",
    icon: ClipboardList,
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    dotClass: "bg-amber-500",
  },
  judgement: {
    label: "陶片放逐",
    icon: Gavel,
    badgeClass: "bg-red-500/10 text-red-600 dark:text-red-300",
    dotClass: "bg-red-500",
  },
};

type JudgementTone = "green" | "yellow" | "red";

type JudgementStyle = {
  badgeClass: string;
  dotClass: string;
  cardClass: string;
  titleClass: string;
  bodyClass: string;
};

const JUDGEMENT_STYLES: Record<JudgementTone, JudgementStyle> = {
  green: {
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
    cardClass: "border-emerald-500/50 bg-emerald-500/5",
    titleClass: "text-emerald-600 dark:text-emerald-300",
    bodyClass: "text-emerald-600/80 dark:text-emerald-200/80",
  },
  yellow: {
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    dotClass: "bg-amber-500",
    cardClass: "border-amber-500/50 bg-amber-500/5",
    titleClass: "text-amber-600 dark:text-amber-300",
    bodyClass: "text-amber-600/80 dark:text-amber-200/80",
  },
  red: {
    badgeClass: TIMELINE_META.judgement.badgeClass,
    dotClass: TIMELINE_META.judgement.dotClass,
    cardClass: "border-red-500/50 bg-red-500/5",
    titleClass: "text-red-600 dark:text-red-300",
    bodyClass: "text-red-600/80 dark:text-red-200/80",
  },
};

function resolveJudgementTone(
  entry: Extract<TimelineEntry, { type: "judgement" }>,
): JudgementTone {
  if (entry.addedPermission && entry.revokedPermission) {
    return "yellow";
  }
  if (entry.addedPermission) {
    return "green";
  }
  return "red";
}

function getJudgementStyle(
  entry: Extract<TimelineEntry, { type: "judgement" }>,
) {
  const tone = resolveJudgementTone(entry);
  return { tone, ...JUDGEMENT_STYLES[tone] };
}

type ResolvedJudgementStyle = ReturnType<typeof getJudgementStyle>;

const VISIBILITY_LABEL: Record<
  Extract<TimelineEntry, { type: "paste" }>["visibility"],
  string
> = {
  public: "公开",
  team: "团队可见",
  private: "仅自己",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

type TimelineApiResponse = {
  entries: TimelineEntry[];
  hasMore: boolean;
  nextCursor: string | null;
};

type UserTimelineProps = {
  userId: number;
  initialEntries: TimelineEntry[];
  initialHasMore: boolean;
  initialCursor: string | null;
};

export function UserTimeline({
  userId,
  initialEntries,
  initialHasMore,
  initialCursor,
}: UserTimelineProps) {
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
    TimelineApiResponse,
    Error,
    InfiniteData<TimelineApiResponse, string | null>,
    ["userTimeline", number],
    string | null
  >({
    queryKey: ["userTimeline", userId],
    queryFn: ({ pageParam }) =>
      fetchTimelinePage(
        userId,
        typeof pageParam === "string" ? pageParam : null,
      ),
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
    } satisfies InfiniteData<TimelineApiResponse, string | null>,
  });

  const timelineEntries = React.useMemo<TimelineEntry[]>(() => {
    if (!data) {
      return initialEntries;
    }
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

  const loadingPlaceholder = (
    <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      正在载入时间线
    </div>
  );

  const emptyState = (
    <div className="rounded-2xl border border-dashed border-border/60 px-6 py-10 text-center text-sm text-muted-foreground">
      暂无时间线记录
    </div>
  );

  const timelineList = (
    <ol className="space-y-6 pl-4">
      {timelineEntries.map((entry) => {
        const meta = TIMELINE_META[entry.type];
        const createdAt = new Date(entry.createdAt);
        const relative = formatRelativeTime(createdAt);
        const Icon = meta.icon;
        const judgementStyle =
          entry.type === "judgement" ? getJudgementStyle(entry) : null;
        const badgeClass = judgementStyle?.badgeClass ?? meta.badgeClass;
        const dotClass = judgementStyle?.dotClass ?? meta.dotClass;

        return (
          <li key={entry.id} className="relative">
            <span
              aria-hidden
              className={cn(
                "absolute top-1.5 -left-[15px] inline-flex size-3 items-center justify-center rounded-full border-2 border-card",
                dotClass,
              )}
            />
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                  badgeClass,
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {meta.label}
              </span>
              <time
                className="text-xs text-muted-foreground"
                dateTime={entry.createdAt}
              >
                {DATE_FORMATTER.format(createdAt)} · {relative}
              </time>
            </div>
            <div className="mt-3 space-y-3">
              {renderTimelineContent(entry, judgementStyle ?? undefined)}
            </div>
          </li>
        );
      })}
    </ol>
  );

  const showLoading = isPending && timelineEntries.length === 0;
  const showEmpty = !isPending && timelineEntries.length === 0;
  const errorMessage = isError
    ? error instanceof Error
      ? error.message
      : "加载更多失败"
    : null;

  return (
    <section>
      <header className="mb-6">
        <h3 className="text-lg font-semibold">时间线</h3>
        <p className="text-sm text-muted-foreground">
          最近的文章、讨论、云剪贴板与社区记录
        </p>
      </header>
      {showLoading ? loadingPlaceholder : null}
      {showEmpty ? emptyState : null}
      {!showLoading && !showEmpty ? timelineList : null}
      <div
        ref={sentinelRef}
        className="flex flex-col items-center gap-3 py-6 text-sm text-muted-foreground"
      >
        {isFetchingNextPage ? (
          <>
            <Loader2 className="size-5 animate-spin" aria-hidden />
            <span>载入更多记录…</span>
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
          <span>已经到最早的记录</span>
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

async function fetchTimelinePage(userId: number, cursor: string | null) {
  const params = new URLSearchParams();
  if (cursor) {
    params.set("cursor", cursor);
  }

  const search = params.toString();
  const response = await fetch(
    `/api/users/${userId.toString()}/timeline${search ? `?${search}` : ""}`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error("时间线加载失败，请稍后重试");
  }

  return (await response.json()) as TimelineApiResponse;
}

function renderTimelineContent(
  entry: TimelineEntry,
  judgementStyle?: ResolvedJudgementStyle,
) {
  switch (entry.type) {
    case "article":
      return (
        <div className="rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm">
          <Link
            href={entry.href}
            className="text-base font-semibold text-foreground hover:underline"
          >
            {entry.title}
          </Link>
          <p className="mt-2 wrap-anywhere text-muted-foreground">
            {entry.summary}
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>获赞 {entry.reactions}</span>
            <span>评论 {entry.comments}</span>
          </div>
        </div>
      );
    case "discussion":
      return (
        <div className="rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm">
          <Link
            href={entry.href}
            className="text-base font-semibold text-foreground hover:underline"
          >
            {entry.title}
          </Link>
          <p className="mt-2 wrap-anywhere text-muted-foreground">
            {entry.summary}
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>回复 {entry.replies}</span>
            <span>参与人数 {entry.participants}</span>
          </div>
        </div>
      );
    case "articleComment":
      return (
        <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm">
          <p className="text-muted-foreground">
            在文章
            <Link
              href={entry.href}
              className="mx-1 font-medium text-foreground hover:underline"
            >
              《{entry.articleTitle}》
            </Link>
            发表评论：
          </p>
          <blockquote className="mt-2 border-l-2 border-primary/40 pl-3 wrap-anywhere text-muted-foreground">
            {entry.excerpt}
          </blockquote>
        </div>
      );
    case "discussionReply":
      return (
        <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm">
          <p className="text-muted-foreground">
            在讨论
            <Link
              href={entry.href}
              className="mx-1 font-medium text-foreground hover:underline"
            >
              《{entry.discussionTitle}》
            </Link>
            回复：
          </p>
          <blockquote className="mt-2 border-l-2 border-primary/40 pl-3 wrap-anywhere text-muted-foreground">
            {entry.excerpt}
          </blockquote>
        </div>
      );
    case "paste":
      return (
        <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm">
          <Link
            href={entry.href}
            className="text-base font-semibold text-foreground hover:underline"
          >
            {entry.title}
          </Link>
          <p className="mt-2 leading-relaxed wrap-anywhere text-muted-foreground">
            {entry.description}
          </p>
          <div className="mt-3 text-xs text-muted-foreground">
            可见性：{VISIBILITY_LABEL[entry.visibility]}
          </div>
        </div>
      );
    case "judgement":
      const style =
        judgementStyle ??
        getJudgementStyle(
          entry as Extract<TimelineEntry, { type: "judgement" }>,
        );
      return (
        <div className={cn("rounded-2xl border p-4 text-sm", style.cardClass)}>
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
          <p className={cn("mt-1", style.bodyClass)}>{entry.reason}</p>
        </div>
      );
    default:
      return null;
  }
}
