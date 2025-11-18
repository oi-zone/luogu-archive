import * as React from "react";
import { focusManager } from "@tanstack/react-query";

import type { CommentCardProps } from "@/components/comments/comment-card";

import { useCommentCollection } from "./use-comment-collection";

type Direction = "before" | "after";

export type CommentChunk<T> = {
  items: T[];
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
  totalCount?: number;
};

type FetchChunkOptions = {
  direction?: Direction;
  cursor?: number;
  limit?: number;
};

type ErrorResolver = (error: unknown) => string;

type TimelineErrorKey =
  | "initial"
  | "loadMoreTop"
  | "loadMoreBottom"
  | "refresh";

export type TimelineMessages = Partial<
  Record<TimelineErrorKey, string | ErrorResolver>
>;

type AnchorOptions = {
  anchorId?: number | null;
  windowSize?: {
    before: number;
    after: number;
  };
};

type AutoRefreshOptions = {
  intervalMs?: number;
  onFocus?: boolean;
};

export type UseCommentTimelineOptions<T> = {
  mapToComment: (input: T) => CommentCardProps;
  fetchChunk: (options?: FetchChunkOptions) => Promise<CommentChunk<T>>;
  fetchSingle?: (id: number) => Promise<T>;
  sort: "oldest" | "newest";
  enablePrepend?: boolean;
  messages?: TimelineMessages;
  autoRefresh?: AutoRefreshOptions;
  initialTotalCount?: number | null;
};

type CommentTimelineState = {
  comments: CommentCardProps[];
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
  loadingInitial: boolean;
  loadingTop: boolean;
  loadingBottom: boolean;
  bottomState: "idle" | "loading" | "end";
  error: string | null;
  totalCount: number | null;
  initialize: (options?: AnchorOptions) => Promise<void>;
  loadMoreTop: () => Promise<number>;
  loadMoreBottom: () => Promise<number>;
  refreshLatest: () => Promise<void>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setTotalCount: React.Dispatch<React.SetStateAction<number | null>>;
  clear: () => void;
};

const DEFAULT_ERROR_FALLBACK = "加载失败，请稍后再试。";

function resolveMessage(
  key: TimelineErrorKey,
  messages: TimelineMessages | undefined,
  error: unknown,
): string {
  const resolver = messages?.[key];
  if (typeof resolver === "function") {
    return resolver(error);
  }
  if (typeof resolver === "string") {
    return resolver;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return DEFAULT_ERROR_FALLBACK;
}

// Provides a shared timeline loader that supports pagination in both directions,
// optional anchor initialization, and optional periodic refresh.
export function useCommentTimeline<T>(
  options: UseCommentTimelineOptions<T>,
): CommentTimelineState {
  const {
    mapToComment,
    fetchChunk,
    fetchSingle,
    sort,
    enablePrepend = true,
    messages,
    autoRefresh,
    initialTotalCount = null,
  } = options;

  const {
    items: comments,
    replaceAll,
    appendUnique,
    prependUnique,
    clear,
  } = useCommentCollection(mapToComment);

  const [hasMoreBefore, setHasMoreBefore] = React.useState(false);
  const [hasMoreAfter, setHasMoreAfter] = React.useState(false);
  const [loadingInitial, setLoadingInitial] = React.useState(true);
  const [loadingTop, setLoadingTop] = React.useState(false);
  const [loadingBottom, setLoadingBottom] = React.useState(false);
  const [bottomState, setBottomState] = React.useState<
    "idle" | "loading" | "end"
  >("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [totalCount, setTotalCount] = React.useState<number | null>(
    initialTotalCount,
  );

  const initialize = React.useCallback(
    async (anchorOptions?: AnchorOptions) => {
      setError(null);
      setLoadingInitial(true);
      setLoadingBottom(true);
      setBottomState("loading");
      clear();

      try {
        if (
          anchorOptions?.anchorId &&
          typeof anchorOptions.anchorId === "number" &&
          fetchSingle
        ) {
          const beforeLimit = anchorOptions.windowSize?.before ?? 5;
          const afterLimit = anchorOptions.windowSize?.after ?? 14;
          const anchorId = anchorOptions.anchorId;

          const [beforeChunk, anchor, afterChunk] = await Promise.all([
            fetchChunk({
              direction: "before",
              cursor: anchorId,
              limit: beforeLimit,
            }),
            fetchSingle(anchorId),
            fetchChunk({
              direction: "after",
              cursor: anchorId,
              limit: afterLimit,
            }),
          ]);

          const combined: T[] = [
            ...beforeChunk.items,
            anchor,
            ...afterChunk.items,
          ];
          replaceAll(combined);
          setHasMoreBefore(beforeChunk.hasMoreBefore);
          setHasMoreAfter(afterChunk.hasMoreAfter);
          if (typeof afterChunk.totalCount === "number") {
            setTotalCount(afterChunk.totalCount);
          } else if (typeof beforeChunk.totalCount === "number") {
            setTotalCount(beforeChunk.totalCount);
          } else {
            setTotalCount((prev) => prev ?? combined.length);
          }
        } else {
          const chunk = await fetchChunk();
          replaceAll(chunk.items);
          setHasMoreBefore(chunk.hasMoreBefore);
          setHasMoreAfter(chunk.hasMoreAfter);
          if (typeof chunk.totalCount === "number") {
            setTotalCount(chunk.totalCount);
          } else {
            setTotalCount((prev) => prev ?? chunk.items.length);
          }
        }
      } catch (err) {
        console.error(err);
        setError(resolveMessage("initial", messages, err));
        replaceAll([]);
        setHasMoreBefore(false);
        setHasMoreAfter(false);
        setTotalCount(null);
      } finally {
        setLoadingInitial(false);
        setLoadingBottom(false);
        setBottomState("idle");
      }
    },
    [clear, fetchChunk, fetchSingle, messages, replaceAll],
  );

  const loadMoreTop = React.useCallback(async () => {
    if (!enablePrepend) return 0;
    if (loadingTop) return 0;
    const first = comments[0];
    const firstId = first?.comment.id;
    if (!firstId) return 0;

    setLoadingTop(true);
    setError(null);

    try {
      const chunk = await fetchChunk({ direction: "before", cursor: firstId });
      const appended = prependUnique(chunk.items);
      setHasMoreBefore(chunk.hasMoreBefore);
      if (typeof chunk.totalCount === "number") {
        setTotalCount(chunk.totalCount);
      }
      return appended;
    } catch (err) {
      console.error(err);
      setError(resolveMessage("loadMoreTop", messages, err));
      return 0;
    } finally {
      setLoadingTop(false);
    }
  }, [
    comments,
    enablePrepend,
    fetchChunk,
    loadingTop,
    messages,
    prependUnique,
  ]);

  const loadMoreBottom = React.useCallback(async () => {
    const last = comments.at(-1);
    const lastId = last?.comment.id;
    if (!lastId) return 0;

    setLoadingBottom(true);
    setBottomState("loading");
    setError(null);

    try {
      let cursor = lastId;
      let totalAppended = 0;
      let latestHasMoreAfter = true;
      let latestTotalCount: number | null = null;
      let iterations = 0;

      while (true) {
        // Retry with a progressed cursor when the backend responds with a page
        // we have already loaded so that we do not get stuck showing "end".
        const chunk = await fetchChunk({ direction: "after", cursor });
        iterations += 1;
        latestHasMoreAfter = chunk.hasMoreAfter;
        if (typeof chunk.totalCount === "number") {
          latestTotalCount = chunk.totalCount;
        }

        const appended = appendUnique(chunk.items);
        totalAppended += appended;

        const shouldStop =
          appended > 0 ||
          !chunk.hasMoreAfter ||
          chunk.items.length === 0 ||
          iterations >= 8;

        if (shouldStop) {
          break;
        }

        const lastEntry = chunk.items.at(-1);
        const nextCursor = lastEntry
          ? mapToComment(lastEntry).comment.id
          : undefined;
        if (!nextCursor || nextCursor === cursor) {
          break;
        }

        cursor = nextCursor;
      }

      setHasMoreAfter(latestHasMoreAfter);
      if (latestTotalCount !== null) {
        setTotalCount(latestTotalCount);
      }

      if (totalAppended === 0 && !latestHasMoreAfter) {
        setBottomState("end");
        if (typeof window !== "undefined") {
          window.setTimeout(() => {
            setBottomState("idle");
          }, 1500);
        }
      } else {
        setBottomState("idle");
      }

      return totalAppended;
    } catch (err) {
      console.error(err);
      setError(resolveMessage("loadMoreBottom", messages, err));
      setBottomState("idle");
      return 0;
    } finally {
      setLoadingBottom(false);
    }
  }, [appendUnique, comments, fetchChunk, mapToComment, messages]);

  const refreshLatest = React.useCallback(async () => {
    if (comments.length === 0) return;

    try {
      if (sort === "oldest") {
        const last = comments.at(-1);
        const lastId = last?.comment.id;
        if (!lastId) return;
        const chunk = await fetchChunk({ direction: "after", cursor: lastId });
        appendUnique(chunk.items);
        setHasMoreAfter(chunk.hasMoreAfter);
        if (typeof chunk.totalCount === "number") {
          setTotalCount(chunk.totalCount);
        }
      } else {
        const first = comments[0];
        const firstId = first?.comment.id;
        if (!firstId) return;
        const chunk = await fetchChunk({
          direction: "before",
          cursor: firstId,
        });
        setHasMoreBefore(chunk.hasMoreBefore);
        if (typeof chunk.totalCount === "number") {
          setTotalCount(chunk.totalCount);
        }
        if (enablePrepend) {
          prependUnique(chunk.items);
        }
      }
    } catch (err) {
      console.error(err);
      if (messages?.refresh !== undefined) {
        setError(resolveMessage("refresh", messages, err));
      }
    }
  }, [
    appendUnique,
    comments,
    enablePrepend,
    fetchChunk,
    messages,
    prependUnique,
    sort,
  ]);

  React.useEffect(() => {
    if (!autoRefresh?.onFocus) return;
    const unsubscribe = focusManager.subscribe((focused) => {
      if (focused) {
        void refreshLatest();
      }
    });

    return unsubscribe;
  }, [autoRefresh?.onFocus, refreshLatest]);

  React.useEffect(() => {
    if (!autoRefresh?.intervalMs) return;
    if (typeof window === "undefined" || typeof document === "undefined")
      return;
    const id = window.setInterval(() => {
      if (document.hasFocus()) {
        void refreshLatest();
      }
    }, autoRefresh.intervalMs);

    return () => {
      window.clearInterval(id);
    };
  }, [autoRefresh?.intervalMs, refreshLatest]);

  const state = React.useMemo<CommentTimelineState>(
    () => ({
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
      refreshLatest,
      setError,
      setTotalCount,
      clear,
    }),
    [
      bottomState,
      clear,
      comments,
      error,
      hasMoreAfter,
      hasMoreBefore,
      initialize,
      loadMoreBottom,
      loadMoreTop,
      loadingBottom,
      loadingInitial,
      loadingTop,
      refreshLatest,
      totalCount,
    ],
  );

  return state;
}
