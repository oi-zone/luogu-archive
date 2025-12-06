"use client";

import * as React from "react";
import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  useCommentTimeline,
  type TimelineMessages,
} from "@/hooks/use-comment-timeline";
import { UserAvatarHoverLink } from "@/components/user/user-inline-link";

import { Button } from "../ui/button";
import { CommentCard, type CommentCardProps } from "./comment-card";

const DEFAULT_TOP_OFFSET = 72;
const STACK_PREVIEW_LIMIT = 3;
const DEFAULT_PAGE_SIZE = 15;
const DEFAULT_REFRESH_INTERVAL = 3 * 60 * 1000;
const DEFAULT_ANCHOR_WINDOW = { before: 5, after: 14 };

type SortOrder = "oldest" | "newest";
type Direction = "before" | "after";

export type { TimelineMessages } from "@/hooks/use-comment-timeline";

export type CommentBoardFetchParams = {
  sort: SortOrder;
  direction?: Direction;
  cursor?: number;
  limit?: number;
};

export type CommentBoardFetchResult = {
  items: CommentCardProps[];
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
  totalCount?: number;
};

export type CommentBoardDataSource = {
  key: readonly unknown[] | string;
  fetchPage: (
    params: CommentBoardFetchParams,
  ) => Promise<CommentBoardFetchResult>;
  fetchSingle?: (id: number) => Promise<CommentCardProps>;
  pageSize?: number;
  enableTopLoad?: boolean;
  autoRefresh?: {
    intervalMs?: number;
    onFocus?: boolean;
  };
};

export type CommentBoardHeaderProps = {
  totalCount: number;
  itemCount: number;
  sort: SortOrder;
  loading: boolean;
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
};

export type CommentBoardRenderState = {
  items: CommentCardProps[];
  loadingInitial: boolean;
  loadingTop: boolean;
  loadingBottom: boolean;
  error: string | null;
  totalCount: number;
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
  bottomState: "idle" | "loading" | "end";
  sort: SortOrder;
  retry: () => void;
};

type DuplicateGroup = {
  id: string;
  anchorId: string;
  representative: CommentCardProps;
  duplicates: CommentCardProps[];
};

type RenderedItem =
  | { type: "comment"; comment: CommentCardProps }
  | { type: "placeholder"; group: DuplicateGroup };

type SortLabels = {
  newest?: string;
  oldest?: string;
};

type CommentBoardProps = React.HTMLAttributes<HTMLElement> & {
  dataSource: CommentBoardDataSource;
  header?:
    | React.ReactNode
    | ((props: CommentBoardHeaderProps) => React.ReactNode);
  searchAction?: { label?: string; onClick: () => void };
  trackScrollHash?: boolean;
  topOffset?: number;
  enableDuplicateStack?: boolean;
  initialSort?: SortOrder;
  sortLabels?: SortLabels;
  sort?: SortOrder;
  onSortChange?: (next: SortOrder) => void;
  renderEmpty?: (state: CommentBoardRenderState) => React.ReactNode;
  renderErrorBanner?: (state: CommentBoardRenderState) => React.ReactNode;
  anchorFromHash?: boolean;
  anchorWindow?: { before: number; after: number };
  initialTotalCount?: number | null;
  messages?: TimelineMessages;
  riDiscussionAuthors?: number[];
};

function getCommentDomId(comment: CommentCardProps["comment"]): string {
  return `${comment.type === "discussionReply" ? "reply" : "comment"}-${comment.id}`;
}

function parseCommentIdFromHash(hash: string): number | null {
  if (!hash.startsWith("#")) return null;
  const match = hash.match(/#(?:reply|comment)-(\d+)/);
  if (!match) return null;
  const value = Number.parseInt(match[1] ?? "", 10);
  return Number.isNaN(value) ? null : value;
}

function isCommentHash(hash: string | null): boolean {
  if (!hash || !hash.startsWith("#")) return false;
  return /^#(?:reply|comment)-\d+$/.test(hash);
}

export function CommentBoard(props: CommentBoardProps) {
  const {
    dataSource,
    className,
    header,
    searchAction,
    trackScrollHash = true,
    topOffset = DEFAULT_TOP_OFFSET,
    enableDuplicateStack = true,
    initialSort = "oldest",
    sortLabels,
    onSortChange,
    sort: sortProp,
    renderEmpty,
    renderErrorBanner,
    anchorFromHash = true,
    anchorWindow,
    initialTotalCount = null,
    messages,
    riDiscussionAuthors,
    ...rest
  } = props;

  const queryClient = useFallbackQueryClient();
  const containerRef = React.useRef<HTMLElement | null>(null);
  const listRef = React.useRef<HTMLUListElement | null>(null);
  const initialHashRef = React.useRef<string | null>(null);
  const isInitialLoadPendingRef = React.useRef(true);
  const initialAnchorId =
    anchorFromHash && typeof window !== "undefined"
      ? parseCommentIdFromHash(window.location.hash)
      : null;
  const anchorCommentIdRef = React.useRef<number | null>(initialAnchorId);
  const pendingScrollAnchorRef = React.useRef<number | null>(initialAnchorId);
  const topLoadPrevFirstIdRef = React.useRef<number | null>(null);
  const topLoadPendingRef = React.useRef(false);
  const initialLoadRef = React.useRef(true);
  const [expandedStacks, setExpandedStacks] = React.useState<Set<string>>(
    () => new Set(),
  );

  const keyParts = React.useMemo(
    () => (Array.isArray(dataSource.key) ? dataSource.key : [dataSource.key]),
    [dataSource.key],
  );

  const pageSize = dataSource.pageSize ?? DEFAULT_PAGE_SIZE;
  const enableTopLoad = dataSource.enableTopLoad ?? true;
  const [internalSort, setInternalSort] =
    React.useState<SortOrder>(initialSort);
  const isControlledSort = sortProp !== undefined;
  const activeSort = isControlledSort ? sortProp! : internalSort;

  React.useEffect(() => {
    if (!isControlledSort) {
      setInternalSort(initialSort);
    }
  }, [initialSort, isControlledSort]);

  const handleSortChange = React.useCallback(
    (next: SortOrder) => {
      if (next === activeSort) return;
      if (!isControlledSort) {
        setInternalSort(next);
      }
      onSortChange?.(next);
    },
    [activeSort, isControlledSort, onSortChange],
  );

  const fetchPage = dataSource.fetchPage;
  const chunkFetcher = React.useCallback(
    async (
      options: { direction?: Direction; cursor?: number; limit?: number } = {},
    ) => {
      const { direction, cursor, limit = pageSize } = options;
      const queryKey = [
        ...keyParts,
        activeSort,
        direction ?? "initial",
        cursor ?? null,
        limit,
      ];
      return queryClient.fetchQuery({
        queryKey,
        queryFn: () =>
          fetchPage({
            sort: activeSort,
            direction,
            cursor,
            limit,
          }),
      });
    },
    [activeSort, fetchPage, keyParts, pageSize, queryClient],
  );

  const fetchSingleSource = dataSource.fetchSingle;
  const fetchSingle = React.useMemo(() => {
    if (!fetchSingleSource) return undefined;
    return (id: number) =>
      queryClient.fetchQuery({
        queryKey: [...keyParts, "single", id],
        queryFn: () => fetchSingleSource(id),
      });
  }, [fetchSingleSource, keyParts, queryClient]);

  const autoRefreshConfig = React.useMemo(
    () => ({
      intervalMs:
        dataSource.autoRefresh?.intervalMs ?? DEFAULT_REFRESH_INTERVAL,
      onFocus: dataSource.autoRefresh?.onFocus ?? true,
    }),
    [dataSource.autoRefresh?.intervalMs, dataSource.autoRefresh?.onFocus],
  );

  const anchorWindowConfig = React.useMemo(
    () => ({
      before: anchorWindow?.before ?? DEFAULT_ANCHOR_WINDOW.before,
      after: anchorWindow?.after ?? DEFAULT_ANCHOR_WINDOW.after,
    }),
    [anchorWindow?.after, anchorWindow?.before],
  );

  const identity = React.useCallback(
    (comment: CommentCardProps) => comment,
    [],
  );

  const {
    comments,
    hasMoreBefore,
    hasMoreAfter,
    loadingInitial,
    loadingTop,
    loadingBottom,
    bottomState,
    error,
    totalCount,
    initialize,
    loadMoreTop,
    loadMoreBottom,
  } = useCommentTimeline<CommentCardProps>({
    mapToComment: identity,
    fetchChunk: chunkFetcher,
    fetchSingle,
    sort: activeSort,
    enablePrepend: enableTopLoad,
    messages,
    autoRefresh: autoRefreshConfig,
    initialTotalCount,
  });

  const disableSort = loadingInitial || loadingTop || loadingBottom;

  const handleRetry = React.useCallback(() => {
    const anchorId =
      anchorFromHash && typeof window !== "undefined"
        ? parseCommentIdFromHash(window.location.hash)
        : null;
    anchorCommentIdRef.current = anchorId;
    pendingScrollAnchorRef.current = anchorId;
    isInitialLoadPendingRef.current = true;
    void initialize({ anchorId, windowSize: anchorWindowConfig });
  }, [anchorFromHash, anchorWindowConfig, initialize]);

  const [retryToken, setRetryToken] = React.useState(0);
  const lastProcessedRetryRef = React.useRef(0);
  const requestRetry = React.useCallback(() => {
    setRetryToken((token) => token + 1);
  }, []);

  React.useEffect(() => {
    if (retryToken === 0) return;
    if (retryToken === lastProcessedRetryRef.current) return;
    lastProcessedRetryRef.current = retryToken;
    handleRetry();
  }, [handleRetry, retryToken]);

  React.useEffect(() => {
    const shouldUseAnchor = anchorFromHash && initialLoadRef.current;
    const anchorId =
      shouldUseAnchor && typeof window !== "undefined"
        ? parseCommentIdFromHash(window.location.hash)
        : null;
    anchorCommentIdRef.current = anchorId;
    pendingScrollAnchorRef.current = anchorId;
    initialLoadRef.current = false;
    isInitialLoadPendingRef.current = true;
    void initialize({ anchorId, windowSize: anchorWindowConfig });
  }, [anchorFromHash, anchorWindowConfig, initialize, activeSort]);

  const displayTotal = React.useMemo(
    () => Math.max(totalCount ?? 0, comments.length),
    [comments.length, totalCount],
  );

  const renderState = React.useMemo<CommentBoardRenderState>(
    () => ({
      items: comments,
      loadingInitial,
      loadingTop,
      loadingBottom,
      error,
      totalCount: displayTotal,
      hasMoreBefore,
      hasMoreAfter,
      bottomState,
      sort: activeSort,
      retry: requestRetry,
    }),
    [
      activeSort,
      bottomState,
      comments,
      displayTotal,
      error,
      hasMoreAfter,
      hasMoreBefore,
      requestRetry,
      loadingBottom,
      loadingInitial,
      loadingTop,
    ],
  );

  const duplicateGroups = React.useMemo(() => {
    if (!enableDuplicateStack) return null;
    if (comments.length === 0) return [];
    const groups: DuplicateGroup[] = [];
    let current: DuplicateGroup | null = null;
    for (const item of comments) {
      if (
        current &&
        current.representative.comment.content === item.comment.content
      ) {
        current.duplicates.push(item);
        continue;
      }
      const nextGroup: DuplicateGroup = {
        id: `stack-${item.comment.id}`,
        anchorId: getCommentDomId(item.comment),
        representative: item,
        duplicates: [],
      };
      groups.push(nextGroup);
      current = nextGroup;
    }
    return groups;
  }, [comments, enableDuplicateStack]);

  React.useEffect(() => {
    if (!duplicateGroups) return;
    setExpandedStacks((prev) => {
      if (prev.size === 0) return prev;
      const validIds = new Set(
        duplicateGroups
          .filter((group) => group.duplicates.length > 0)
          .map((group) => group.id),
      );
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [duplicateGroups]);

  React.useEffect(() => {
    if (!duplicateGroups || duplicateGroups.length === 0) return;
    const anchorId = anchorCommentIdRef.current;
    if (anchorId === null) return;
    const targetGroup = duplicateGroups.find((group) => {
      if (group.representative.comment.id === anchorId) return true;
      return group.duplicates.some(
        (duplicate) => duplicate.comment.id === anchorId,
      );
    });
    if (!targetGroup) return;
    pendingScrollAnchorRef.current = anchorId;
    if (targetGroup.duplicates.length > 0) {
      setExpandedStacks((prev) => {
        if (prev.has(targetGroup.id)) return prev;
        const next = new Set(prev);
        next.add(targetGroup.id);
        return next;
      });
    }
    anchorCommentIdRef.current = null;
  }, [duplicateGroups]);

  const renderedItems = React.useMemo<RenderedItem[]>(() => {
    if (!duplicateGroups) {
      return comments.map((item) => ({ type: "comment", comment: item }));
    }
    const results: RenderedItem[] = [];
    duplicateGroups.forEach((group) => {
      results.push({ type: "comment", comment: group.representative });
      if (group.duplicates.length === 0) return;
      if (expandedStacks.has(group.id)) {
        group.duplicates.forEach((duplicate) => {
          results.push({ type: "comment", comment: duplicate });
        });
      } else {
        results.push({ type: "placeholder", group });
      }
    });
    return results;
  }, [comments, duplicateGroups, expandedStacks]);

  const handleExpandStack = React.useCallback((groupId: string) => {
    setExpandedStacks((prev) => {
      if (prev.has(groupId)) return prev;
      const next = new Set(prev);
      next.add(groupId);
      return next;
    });
  }, []);

  const updateHash = React.useCallback(() => {
    if (!trackScrollHash) return;
    if (typeof window === "undefined" || typeof document === "undefined")
      return;

    if (initialHashRef.current === null) {
      initialHashRef.current = window.location.hash || null;
    }

    const listElement = listRef.current;
    const containerElement = containerRef.current ?? listElement;
    if (!containerElement) return;

    const base = `${window.location.pathname}${window.location.search}`;
    const currentHash = window.location.hash;
    const managingCurrentHash = isCommentHash(currentHash);
    const canClearHash =
      managingCurrentHash && !isInitialLoadPendingRef.current;

    const clearHash = () => {
      window.history.replaceState(null, "", base);
      initialHashRef.current = null;
    };

    const commentElements = Array.from(
      containerElement.querySelectorAll<HTMLElement>(
        'article[id^="reply-"], article[id^="comment-"], article[data-stack-parent-id]',
      ),
    );

    if (commentElements.length === 0) {
      if (canClearHash) clearHash();
      return;
    }

    const containerRect = containerElement.getBoundingClientRect();
    if (containerRect.top > topOffset || containerRect.bottom <= topOffset) {
      if (canClearHash) clearHash();
      return;
    }

    const firstElement = commentElements[0];
    const firstRect = firstElement.getBoundingClientRect();
    let activeId: string | null = null;

    const getElementAnchor = (element: HTMLElement): string | null =>
      element.id || element.dataset.stackParentId || null;

    if (topOffset < firstRect.top && topOffset >= containerRect.top) {
      activeId = getElementAnchor(firstElement);
    }

    if (activeId === null) {
      for (const element of commentElements) {
        const rect = element.getBoundingClientRect();
        const candidateId = getElementAnchor(element);
        if (!candidateId) continue;
        if (rect.top <= topOffset && rect.bottom >= topOffset) {
          activeId = candidateId;
          break;
        }
        if (rect.top > topOffset) {
          activeId = candidateId;
          break;
        }
      }
    }

    if (activeId) {
      const nextHash = `#${activeId}`;
      if (currentHash !== nextHash) {
        window.history.replaceState(null, "", `${base}${nextHash}`);
      }
      initialHashRef.current = null;
      isInitialLoadPendingRef.current = false;
      return;
    }

    if (canClearHash) {
      clearHash();
    }
  }, [topOffset, trackScrollHash]);

  React.useEffect(() => {
    if (!trackScrollHash) return;
    if (typeof window === "undefined") return;

    let frame = 0;
    const handler = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
        updateHash();
        frame = 0;
      });
    };

    window.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("resize", handler);
    handler();

    return () => {
      window.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [comments, trackScrollHash, updateHash]);

  React.useEffect(() => {
    if (!trackScrollHash) return;
    if (typeof window === "undefined" || typeof document === "undefined")
      return;
    const anchorId = pendingScrollAnchorRef.current;
    if (anchorId === null) return;
    const targetItem = comments.find((item) => item.comment.id === anchorId);
    if (!targetItem) return;
    const domId = getCommentDomId(targetItem.comment);
    const element = document.getElementById(domId);
    if (!element) return;
    pendingScrollAnchorRef.current = null;
    const frame = window.requestAnimationFrame(() => {
      const top =
        element.getBoundingClientRect().top + window.scrollY - topOffset - 8;
      window.scrollTo({ top: Math.max(top, 0), behavior: "auto" });
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [comments, topOffset, trackScrollHash]);

  React.useEffect(() => {
    if (!trackScrollHash) return;
    if (typeof window === "undefined") return;
    const frame = window.requestAnimationFrame(() => {
      updateHash();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [expandedStacks, trackScrollHash, updateHash]);

  React.useEffect(() => {
    if (loadingInitial) return;
    if (!isInitialLoadPendingRef.current) return;
    isInitialLoadPendingRef.current = false;
  }, [loadingInitial]);

  React.useEffect(() => {
    if (!topLoadPendingRef.current) return;
    const firstItem = comments[0];
    if (!firstItem) return;
    const prevFirstId = topLoadPrevFirstIdRef.current;
    const currentFirstId = firstItem.comment.id;
    if (prevFirstId !== null && currentFirstId === prevFirstId) {
      return;
    }
    topLoadPendingRef.current = false;
    topLoadPrevFirstIdRef.current = null;
    if (typeof window === "undefined" || typeof document === "undefined")
      return;
    const target = document.getElementById(getCommentDomId(firstItem.comment));
    if (!target) return;
    const targetTop =
      target.getBoundingClientRect().top + window.scrollY - topOffset - 8;
    window.scrollTo({ top: Math.max(targetTop, 0), behavior: "auto" });
  }, [comments, topOffset]);

  const sortLabelText: Required<SortLabels> = {
    newest: sortLabels?.newest ?? "最新优先",
    oldest: sortLabels?.oldest ?? "最早优先",
  };

  const headerNode =
    typeof header === "function"
      ? header({
          totalCount: displayTotal,
          itemCount: comments.length,
          sort: activeSort,
          loading: loadingInitial,
          hasMoreBefore,
          hasMoreAfter,
        })
      : (header ?? null);

  const handleLoadMoreTopClick = React.useCallback(() => {
    if (loadingTop) return;
    topLoadPrevFirstIdRef.current = comments[0]?.comment.id ?? null;
    topLoadPendingRef.current = true;
    void loadMoreTop()
      .then((appended) => {
        if (appended === 0) {
          topLoadPendingRef.current = false;
        }
      })
      .catch(() => {
        topLoadPendingRef.current = false;
      });
  }, [comments, loadMoreTop, loadingTop]);

  const topButton =
    enableTopLoad && hasMoreBefore && comments.length > 0 ? (
      <div className="flex justify-center pt-2">
        <Button
          type="button"
          variant="secondary"
          className="rounded-xl px-4"
          disabled={loadingTop}
          onClick={handleLoadMoreTopClick}
        >
          {loadingTop ? "加载中..." : "加载更多"}
        </Button>
      </div>
    ) : null;

  const bottomLabel = React.useMemo(() => {
    if (bottomState === "end") return "你已经到底了";
    if (bottomState === "loading") return "加载中...";
    return "加载更多";
  }, [bottomState]);

  const showBottomButton =
    comments.length > 0 && (hasMoreAfter || bottomState === "end");
  const bottomVariant = enableTopLoad ? "ghost" : "outline";
  const bottomButton = showBottomButton ? (
    <div className="flex justify-center">
      <Button
        type="button"
        variant={bottomVariant}
        className="rounded-xl px-4"
        disabled={loadingBottom && bottomState !== "end"}
        onClick={() => void loadMoreBottom()}
      >
        {bottomLabel}
      </Button>
    </div>
  ) : null;

  const defaultEmptyContent = React.useCallback(() => {
    if (loadingInitial) {
      return (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          正在加载评论...
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex flex-col items-center gap-3 text-center text-sm text-destructive">
          <p>{error}</p>
          <Button type="button" size="sm" onClick={requestRetry}>
            重试
          </Button>
        </div>
      );
    }
    return "你似乎来到了没有知识的荒原。";
  }, [error, loadingInitial, requestRetry]);

  const emptyContent = renderEmpty?.(renderState) ?? defaultEmptyContent();

  let errorBanner: React.ReactNode = null;
  if (error && comments.length > 0) {
    errorBanner = renderErrorBanner?.(renderState) ?? (
      <p className="text-sm text-destructive">{error}</p>
    );
  }

  const sortControls = (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-background px-1 py-1">
      <Button
        type="button"
        variant={activeSort === "newest" ? "secondary" : "ghost"}
        size="sm"
        className="rounded-lg px-2"
        disabled={disableSort}
        aria-pressed={activeSort === "newest"}
        onClick={() => handleSortChange("newest")}
      >
        {sortLabelText.newest}
      </Button>
      <Button
        type="button"
        variant={activeSort === "oldest" ? "secondary" : "ghost"}
        size="sm"
        className="rounded-lg px-2"
        disabled={disableSort}
        aria-pressed={activeSort === "oldest"}
        onClick={() => handleSortChange("oldest")}
      >
        {sortLabelText.oldest}
      </Button>
    </div>
  );

  const searchButton = searchAction ? (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="hidden gap-1.5 rounded-xl"
      onClick={searchAction.onClick}
    >
      <Search className="size-4" aria-hidden="true" />
      {searchAction.label ?? "搜索"}
    </Button>
  ) : null;

  const hasHeaderContent = Boolean(headerNode || searchButton || sortControls);

  return (
    <section
      ref={containerRef as React.RefObject<HTMLElement>}
      className={cn("space-y-6", className)}
      data-comment-board=""
      {...rest}
    >
      {errorBanner}
      <div className="space-y-4">
        {hasHeaderContent ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>{headerNode}</div>
            <div className="flex items-center gap-2">
              {sortControls}
              {searchButton}
            </div>
          </div>
        ) : null}

        {comments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
            {emptyContent}
          </div>
        ) : (
          <div className="space-y-4">
            {topButton}
            <ul ref={listRef} className="space-y-6">
              {renderedItems.map((item) => (
                <li
                  key={
                    item.type === "comment"
                      ? getCommentDomId(item.comment.comment)
                      : `placeholder-${item.group.id}`
                  }
                >
                  {item.type === "comment" ? (
                    <CommentCard
                      {...item.comment}
                      riDiscussionAuthors={riDiscussionAuthors}
                    />
                  ) : (
                    <DuplicatePlaceholder
                      group={item.group}
                      onExpand={() => handleExpandStack(item.group.id)}
                    />
                  )}
                </li>
              ))}
            </ul>
            {bottomButton}
          </div>
        )}
      </div>
    </section>
  );
}

function useFallbackQueryClient() {
  const fallbackRef = React.useRef<QueryClient | null>(null);

  try {
    return useQueryClient();
  } catch {
    if (!fallbackRef.current) {
      fallbackRef.current = new QueryClient();
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "CommentBoard rendered outside QueryProvider; using an isolated QueryClient. Wrap the tree with <QueryProvider> to share cache.",
        );
      }
    }
    return fallbackRef.current;
  }
}

type DuplicatePlaceholderProps = {
  group: DuplicateGroup;
  onExpand: () => void;
};

function DuplicatePlaceholder({ group, onExpand }: DuplicatePlaceholderProps) {
  const repeatCount = group.duplicates.length;
  const previewUsers: CommentCardProps["comment"]["author"][] = [];
  const seen = new Set<number>();
  for (const duplicate of group.duplicates) {
    const user = duplicate.comment.author;
    if (seen.has(user.id)) continue;
    seen.add(user.id);
    previewUsers.push(user);
    if (previewUsers.length >= STACK_PREVIEW_LIMIT) break;
  }

  return (
    <article className="-mt-5" data-stack-parent-id={group.anchorId}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="mt-0.75 inline-flex -space-x-1.5">
            {previewUsers.map((user) => (
              <UserAvatarHoverLink key={user.id} user={user} className="" />
            ))}
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            等 {repeatCount} 位用户复读了
          </span>
        </div>
        <button
          type="button"
          className="-my-0.5 cursor-pointer rounded-full bg-muted px-2 py-0.5 text-sm transition-colors duration-150 hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          onClick={onExpand}
        >
          展开
        </button>
      </div>
    </article>
  );
}
