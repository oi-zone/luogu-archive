"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  CommentBoard,
  type CommentBoardDataSource,
  type CommentBoardFetchParams,
  type CommentBoardFetchResult,
  type CommentBoardHeaderProps,
  type CommentBoardRenderState,
  type TimelineMessages,
} from "@/components/comments/comment-board";
import { type CommentCardProps } from "@/components/comments/comment-card";

export type CommentSort = "oldest" | "newest";

export type ArticleCommentDTO = {
  id: number;
  articleId: string;
  time: string;
  content: string;
  updatedAt: string;
  authorId: number;
  author: CommentCardProps["comment"]["author"];
};

export type CommentsApiResponse = {
  items: ArticleCommentDTO[];
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
  totalCount?: number;
};

export type ArticleCommentsProps = {
  article: {
    id: string;
    authorId: number;
    allCommentsCount: number;
  };
};

const PAGE_SIZE = 15;
const REFRESH_INTERVAL = 3 * 60 * 1000;
const TOP_OFFSET = 72;

const ORDER_PARAM: Record<CommentSort, "newest" | "oldest"> = {
  newest: "newest",
  oldest: "oldest",
};

async function requestArticleComments({
  articleId,
  order,
  limit,
  before,
  after,
}: {
  articleId: string;
  order: CommentSort;
  limit: number;
  before?: number;
  after?: number;
}): Promise<CommentsApiResponse> {
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
    `/api/articles/${articleId}/comments?${params.toString()}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error("Failed to load article comments");
  }

  return response.json();
}

async function requestSingleComment({
  articleId,
  commentId,
}: {
  articleId: string;
  commentId: number;
}): Promise<ArticleCommentDTO> {
  const response = await fetch(
    `/api/articles/${articleId}/comments/${commentId}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error("Comment not found");
  }

  return response.json();
}

const mapDtoToComment = (
  dto: ArticleCommentDTO,
  authorId: number,
): CommentCardProps => {
  const id = Number(dto.id);

  return {
    comment: {
      type: "articleComment",
      id,
      articleId: dto.articleId,
      time: new Date(dto.time),
      content: dto.content,
      updatedAt: new Date(dto.updatedAt),
      author: dto.author,
    },
    isFromDiscussionAuthor: false,
    isFromArticleAuthor: dto.authorId === authorId,
    isPinned: false,
  };
};

export default function ArticleComments({ article }: ArticleCommentsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const orderParam = searchParams.get("order-by");
  const sort: CommentSort = orderParam === "oldest" ? "oldest" : "newest";

  const dataSource = React.useMemo<CommentBoardDataSource>(
    () => ({
      key: ["article-comments", article.id],
      pageSize: PAGE_SIZE,
      autoRefresh: { intervalMs: REFRESH_INTERVAL, onFocus: true },
      fetchPage: async ({
        sort,
        direction,
        cursor,
        limit,
      }: CommentBoardFetchParams) => {
        const response = await requestArticleComments({
          articleId: article.id,
          order: sort,
          limit: limit ?? PAGE_SIZE,
          before: direction === "before" ? cursor : undefined,
          after: direction === "after" ? cursor : undefined,
        });

        return {
          items: response.items.map((item) =>
            mapDtoToComment(item, article.authorId),
          ),
          hasMoreBefore: response.hasMoreBefore,
          hasMoreAfter: response.hasMoreAfter,
          // totalCount: response.totalCount,
        } satisfies CommentBoardFetchResult;
      },
      fetchSingle: async (commentId: number) => {
        const dto = await requestSingleComment({
          articleId: article.id,
          commentId,
        });
        return mapDtoToComment(dto, article.authorId);
      },
    }),
    [article.authorId, article.id],
  );

  const updateUrlSort = React.useCallback(
    (nextSort: CommentSort) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextSort === "oldest") {
        params.set("order-by", "oldest");
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
    (nextSort: CommentSort) => {
      if (nextSort === sort) return;
      updateUrlSort(nextSort);
    },
    [sort, updateUrlSort],
  );

  const handleOpenSearch = React.useCallback(() => {
    router.push("/search?category=article-comment", { scroll: false });
  }, [router]);

  const messages = React.useMemo<TimelineMessages>(
    () => ({
      initial: "加载评论失败，请稍后再试。",
      loadMoreTop: "加载更多评论失败，请稍后再试。",
      loadMoreBottom: "加载更多评论失败，请稍后再试。",
      refresh: "刷新评论失败，请稍后再试。",
    }),
    [],
  );

  const renderHeader = React.useCallback(
    ({ totalCount }: CommentBoardHeaderProps) => {
      const count = Math.max(totalCount, article.allCommentsCount);
      return (
        <>
          <h2 className="text-xl font-semibold text-foreground">评论</h2>
          <p className="text-sm text-muted-foreground">
            共 {count.toLocaleString("zh-CN")} 条评论，欢迎与作者交流。
          </p>
        </>
      );
    },
    [article.allCommentsCount],
  );

  const renderEmpty = React.useCallback((state: CommentBoardRenderState) => {
    if (state.loadingInitial) {
      return (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          正在加载评论...
        </div>
      );
    }

    if (state.error) {
      return (
        <div className="flex flex-col items-center gap-3 text-center text-sm text-destructive">
          <p>{state.error}</p>
          <Button type="button" size="sm" onClick={state.retry}>
            重试
          </Button>
        </div>
      );
    }

    return "暂无评论，快来发表第一条看法。";
  }, []);

  const renderErrorBanner = React.useCallback(
    (state: CommentBoardRenderState) =>
      state.error ? (
        <p className="mt-4 text-sm text-destructive">{state.error}</p>
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
      initialTotalCount={article.allCommentsCount}
      renderEmpty={renderEmpty}
      renderErrorBanner={renderErrorBanner}
      header={renderHeader}
      anchorWindow={{ before: 5, after: 9 }}
      topOffset={TOP_OFFSET}
      messages={messages}
      data-comments-root=""
    />
  );
}
