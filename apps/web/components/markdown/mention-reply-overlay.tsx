"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";

import { CommentCard } from "../comments/comment-card";
import { Button } from "../ui/button";
import Markdown from "./markdown";

export type MentionReply = {
  id: number;
  postId: number;
  time: number;
  content: string;
  capturedAt: number;
  lastSeenAt: number;
  authorId: number;
  author: {
    id: number;
    name: string;
    badge: string | null;
    color: string;
    ccfLevel: number;
    xcpcLevel: number;
  };
  snapshotsCount: number;
};

export type MentionReplyInferenceResult = {
  reply: MentionReply;
  previousReplyId: number | null;
  nextReplyId: number | null;
  hasPrevious: boolean;
  hasNext: boolean;
};

type MentionReplyOverlayProps = {
  discussionId: number;
  mentionUserId: number;
  relativeReplyId?: number;
  children: React.ReactNode;
  className?: string;
  isFromDiscussionAuthor?: boolean;
};

type RectSnapshot = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

type OverlayState = {
  open: boolean;
  anchorRect: RectSnapshot | null;
  containerRect: RectSnapshot | null;
};

function snapshotRect(rect: DOMRect): RectSnapshot {
  return {
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

async function fetchMentionReply(params: {
  discussionId: number;
  userId: number;
  cursor?: number;
  relativeTo?: number;
}): Promise<MentionReplyInferenceResult> {
  const url = new URL(
    `/api/discussions/${params.discussionId}/reply-inference/${params.userId}`,
    window.location.origin,
  );
  if (params.cursor) {
    url.searchParams.set("cursor", String(params.cursor));
  }
  if (params.relativeTo) {
    url.searchParams.set("relativeTo", String(params.relativeTo));
  }
  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load mention reply");
  }
  return response.json();
}

export function MentionReplyOverlayTrigger({
  discussionId,
  mentionUserId,
  relativeReplyId,
  children,
  className,
  isFromDiscussionAuthor,
}: MentionReplyOverlayProps) {
  const [overlayState, setOverlayState] = React.useState<OverlayState>({
    open: false,
    anchorRect: null,
    containerRect: null,
  });
  const [data, setData] = React.useState<MentionReplyInferenceResult | null>(
    null,
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const currentReplyIdRef = React.useRef<number | undefined>(undefined);

  const anchorRef = React.useRef<HTMLButtonElement | null>(null);
  const overlayRef = React.useRef<HTMLDivElement | null>(null);

  const loadData = React.useCallback(
    async (options?: { cursor?: number; relative?: number }) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchMentionReply({
          discussionId,
          userId: mentionUserId,
          cursor: options?.cursor,
          relativeTo: options?.relative,
        });
        setData(result);
        currentReplyIdRef.current = result.reply.id;
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setLoading(false);
      }
    },
    [discussionId, mentionUserId],
  );

  const handleOpen = React.useCallback(() => {
    const anchorEl = anchorRef.current;
    if (!anchorEl) return;
    const anchorRect = snapshotRect(anchorEl.getBoundingClientRect());
    const cardElement = anchorEl.closest(".comment-card");
    const containerRect = snapshotRect(
      (cardElement instanceof HTMLElement
        ? cardElement
        : anchorEl
      ).getBoundingClientRect(),
    );
    setOverlayState({
      open: true,
      anchorRect,
      containerRect,
    });
    if (!data && !loading) {
      void loadData({ relative: relativeReplyId });
    }
  }, [data, loadData, loading, relativeReplyId]);

  const handleClose = React.useCallback(() => {
    setOverlayState({ open: false, anchorRect: null, containerRect: null });
  }, []);

  const handlePrev = React.useCallback(() => {
    if (!data?.previousReplyId) return;
    void loadData({ cursor: data.previousReplyId });
  }, [data?.previousReplyId, loadData]);

  const handleNext = React.useCallback(() => {
    if (!data?.nextReplyId) return;
    void loadData({ cursor: data.nextReplyId });
  }, [data?.nextReplyId, loadData]);

  React.useEffect(() => {
    if (!overlayState.open) return;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };
    const onClickOutside = (event: MouseEvent) => {
      if (!overlayRef.current || !overlayState.open) return;
      if (
        event.target instanceof Node &&
        overlayRef.current.contains(event.target)
      ) {
        return;
      }
      if (
        anchorRef.current &&
        event.target instanceof Node &&
        anchorRef.current.contains(event.target)
      ) {
        return;
      }
      handleClose();
    };
    document.addEventListener("keydown", onEsc);
    document.addEventListener("mousedown", onClickOutside);
    // document.addEventListener("touchstart", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.removeEventListener("mousedown", onClickOutside);
      // document.removeEventListener("touchstart", onClickOutside);
    };
  }, [handleClose, overlayState.open]);

  const recomputeLayout = React.useCallback(() => {
    if (!overlayState.open) return;
    const anchorEl = anchorRef.current;
    if (!anchorEl) return;
    const anchorRect = snapshotRect(anchorEl.getBoundingClientRect());
    const cardElement = anchorEl.closest(".comment-card");
    const containerRect = snapshotRect(
      (cardElement instanceof HTMLElement
        ? cardElement
        : anchorEl
      ).getBoundingClientRect(),
    );
    setOverlayState((prev) => {
      if (!prev.open) return prev;
      return {
        ...prev,
        anchorRect,
        containerRect,
      };
    });
  }, [overlayState.open]);

  React.useEffect(() => {
    if (!overlayState.open) return;
    if (typeof window === "undefined") return;
    const handleResize = () => {
      recomputeLayout();
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [overlayState.open, recomputeLayout]);

  const positionStyles = React.useMemo(() => {
    const anchorRect = overlayState.anchorRect;
    const containerRect = overlayState.containerRect ?? anchorRect;
    if (!anchorRect || !containerRect) {
      return {};
    }
    const width = containerRect.width;
    const viewportWidth =
      typeof window !== "undefined" ? window.innerWidth : undefined;
    const viewportHeight =
      typeof window !== "undefined" ? window.innerHeight : undefined;
    const overlayHeight = 240;
    const rawTop = anchorRect.bottom + 8;
    const rawLeft = containerRect.left;
    let left = rawLeft;
    if (viewportWidth && width) {
      if (width >= viewportWidth) {
        left = 0;
      } else {
        left = Math.min(rawLeft, viewportWidth - width);
        left = Math.max(0, left);
      }
    }
    const top = viewportHeight
      ? Math.min(rawTop, Math.max(8, viewportHeight - overlayHeight))
      : rawTop;
    return {
      top,
      left,
      width,
    } satisfies React.CSSProperties;
  }, [overlayState.anchorRect, overlayState.containerRect]);

  return (
    <>
      <button
        type="button"
        ref={anchorRef}
        className={cn(
          "mention-reply-trigger text-muted-foreground transition-colors hover:text-foreground",
          className,
        )}
        onClick={overlayState.open ? handleClose : handleOpen}
        aria-label="查看被提到的人都说了什么"
      >
        {children}
      </button>
      {overlayState.open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={overlayRef}
              className="mention-reply-overlay fixed z-50 rounded-2xl border border-border bg-popover/50 p-4 text-sm shadow-lg backdrop-blur-xs"
              style={positionStyles}
            >
              <div>
                {loading ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    <span className="ms-2">加载中…</span>
                  </div>
                ) : error ? (
                  <div className="text-sm text-destructive">{error}</div>
                ) : data ? (
                  <CommentCard
                    comment={{
                      ...data.reply,
                      time: new Date(data.reply.time * 1000),
                      capturedAt: new Date(data.reply.capturedAt * 1000),
                      lastSeenAt: new Date(data.reply.lastSeenAt * 1000),
                      type: "discussionReply",
                    }}
                    isFromDiscussionAuthor={isFromDiscussionAuthor}
                    maxHeight={480}
                  />
                ) : null}
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs">
                <Button
                  variant="secondary"
                  className="size-8 cursor-pointer rounded-full"
                  disabled={!data?.hasPrevious || loading}
                  onClick={handlePrev}
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <Button
                  variant="secondary"
                  className="size-8 cursor-pointer rounded-full"
                  disabled={!data?.hasNext || loading}
                  onClick={handleNext}
                >
                  <ArrowRight className="size-4" />
                </Button>
                <div className="flex-grow" />
                <Button
                  variant="secondary"
                  className="size-8 cursor-pointer rounded-full"
                  onClick={handleClose}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
