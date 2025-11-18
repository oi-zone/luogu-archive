"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  CommentBoard,
  type CommentBoardFetchParams,
  type CommentBoardFetchResult,
  type CommentBoardHeaderProps,
  type CommentBoardRenderState,
  type TimelineMessages,
} from "@/components/comments/comment-board";
import type { CommentCardProps } from "@/components/comments/comment-card";

type ReplySort = "oldest" | "newest";

type DiscussionReplyDTO = {
  id: number;
  postId: number;
  time: string;
  content: string;
  capturedAt: string;
  lastSeenAt: string;
  authorId: number;
  author: CommentCardProps["comment"]["author"];
  snapshotsCount: number;
};

type RepliesApiResponse = {
  items: DiscussionReplyDTO[];
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
};

type DiscussionRepliesProps = {
  discussion: {
    id: number;
    authors: number[];
    allRepliesCount: number;
  };
};

const PAGE_SIZE = 15;
const REFRESH_INTERVAL = 3 * 60 * 1000;
const TOP_OFFSET = 72;

const ORDER_PARAM: Record<ReplySort, "newest" | "oldest"> = {
  newest: "newest",
  oldest: "oldest",
};

async function requestDiscussionReplies({
  discussionId,
  order,
  limit,
  before,
  after,
}: {
  discussionId: number;
  order: ReplySort;
  limit: number;
  before?: number;
  after?: number;
}): Promise<RepliesApiResponse> {
  const params = new URLSearchParams();
  params.set("order", ORDER_PARAM[order]);
  params.set("limit", String(limit));

  if (before !== undefined && before !== null) {
    params.set("before", String(before));
  }

  if (after !== undefined && after !== null) {
    params.set("after", String(after));
  }

  const response = await fetch(
    `/api/discussions/${discussionId}/replies?${params.toString()}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error("Failed to load discussion replies");
  }

  return response.json();
}

async function requestSingleReply({
  discussionId,
  replyId,
}: {
  discussionId: number;
  replyId: number;
}): Promise<DiscussionReplyDTO> {
  const response = await fetch(
    `/api/discussions/${discussionId}/replies/${replyId}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error("Reply not found");
  }

  return response.json();
}

const mapReplyToComment = (
  dto: DiscussionReplyDTO,
  authors: number[],
): CommentCardProps => {
  const id = Number(dto.id);
  const postId = Number(dto.postId);

  return {
    comment: {
      type: "discussionReply",
      id,
      postId,
      time: new Date(dto.time),
      content: dto.content,
      capturedAt: new Date(dto.capturedAt),
      lastSeenAt: new Date(dto.lastSeenAt),
      author: dto.author,
      snapshotsCount: dto.snapshotsCount,
    },
    isFromDiscussionAuthor: authors.includes(dto.authorId),
    isFromArticleAuthor: false,
    isPinned: false,
  };
};

export default function DiscussionReplies({
  discussion,
}: DiscussionRepliesProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const orderParam = searchParams.get("order-by");
  const sort: ReplySort = orderParam === "latest" ? "newest" : "oldest";

  const dataSource = React.useMemo(
    () => ({
      key: ["discussion-replies", discussion.id],
      pageSize: PAGE_SIZE,
      autoRefresh: { intervalMs: REFRESH_INTERVAL, onFocus: true },
      fetchPage: async ({
        sort,
        direction,
        cursor,
        limit,
      }: CommentBoardFetchParams) => {
        const response = await requestDiscussionReplies({
          discussionId: discussion.id,
          order: sort,
          limit: limit ?? PAGE_SIZE,
          before: direction === "before" ? cursor : undefined,
          after: direction === "after" ? cursor : undefined,
        });

        return {
          items: response.items.map((item) =>
            mapReplyToComment(item, discussion.authors),
          ),
          hasMoreBefore: response.hasMoreBefore,
          hasMoreAfter: response.hasMoreAfter,
        } satisfies CommentBoardFetchResult;
      },
      fetchSingle: async (replyId: number) => {
        const dto = await requestSingleReply({
          discussionId: discussion.id,
          replyId,
        });
        return mapReplyToComment(dto, discussion.authors);
      },
    }),
    [discussion.authors, discussion.id],
  );

  const updateUrlSort = React.useCallback(
    (nextSort: ReplySort) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextSort === "newest") {
        params.set("order-by", "latest");
      } else {
        params.delete("order-by");
      }

      router.replace(
        params.size > 0 ? `${pathname}?${params.toString()}` : pathname,
        { scroll: false },
      );
    },
    [pathname, router, searchParams],
  );

  const handleSortChange = React.useCallback(
    (nextSort: ReplySort) => {
      if (nextSort === sort) return;
      updateUrlSort(nextSort);
    },
    [sort, updateUrlSort],
  );

  const handleOpenSearch = React.useCallback(() => {
    router.push("/search?category=discussion-reply", { scroll: false });
  }, [router]);

  const messages = React.useMemo<TimelineMessages>(
    () => ({
      initial: "加载回复失败，请稍后再试。",
      loadMoreTop: "加载更多回复失败，请稍后再试。",
      loadMoreBottom: "加载更多回复失败，请稍后再试。",
      refresh: "刷新回复失败，请稍后再试。",
    }),
    [],
  );

  const renderHeader = React.useCallback(
    ({ totalCount }: CommentBoardHeaderProps) => {
      const count = Math.max(totalCount, discussion.allRepliesCount);
      return (
        <>
          <h2 className="text-foreground text-xl font-semibold">回复</h2>
          <p className="text-muted-foreground text-sm">
            共 {count.toLocaleString("zh-CN")} 条回复，欢迎继续交流。
          </p>
        </>
      );
    },
    [discussion.allRepliesCount],
  );

  const renderEmpty = React.useCallback((state: CommentBoardRenderState) => {
    if (state.loadingInitial) {
      return (
        <div className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
          正在加载回复...
        </div>
      );
    }

    if (state.error) {
      return (
        <div className="text-destructive flex flex-col items-center gap-3 text-center text-sm">
          <p>{state.error}</p>
          <Button type="button" size="sm" onClick={state.retry}>
            重试
          </Button>
        </div>
      );
    }

    return "暂无回复，快来抢沙发。";
  }, []);

  const renderErrorBanner = React.useCallback(
    (state: CommentBoardRenderState) =>
      state.error ? (
        <p className="text-destructive mt-4 text-sm">{state.error}</p>
      ) : null,
    [],
  );

  return (
    <CommentBoard
      className="mt-6"
      dataSource={dataSource}
      sort={sort}
      onSortChange={handleSortChange}
      sortLabels={{ newest: "最新优先", oldest: "最早优先" }}
      searchAction={{ onClick: handleOpenSearch, label: "搜索" }}
      initialTotalCount={discussion.allRepliesCount}
      renderEmpty={renderEmpty}
      renderErrorBanner={renderErrorBanner}
      header={renderHeader}
      anchorWindow={{ before: 5, after: 9 }}
      topOffset={TOP_OFFSET}
      messages={messages}
      data-replies-root=""
    />
  );
}
