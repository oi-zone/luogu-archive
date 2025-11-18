import { NextResponse } from "next/server";

import { getArticleComments } from "@luogu-discussion-archive/query";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

const ORDER_MAP = {
  newest: "time_desc" as const,
  oldest: "time_asc" as const,
};

type OrderParam = keyof typeof ORDER_MAP;

type CommentResponseItem = {
  id: number;
  articleId: string;
  time: string;
  content: string;
  updatedAt: string;
  authorId: number;
  author: {
    id: number;
    name: string;
    badge: string | null;
    color: string;
    ccfLevel: number;
    xcpcLevel: number;
  };
};

type CommentResponseBody = {
  items: CommentResponseItem[];
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
};

function mapCommentToResponse(
  comment: Awaited<ReturnType<typeof getArticleComments>>[number],
): CommentResponseItem {
  const authorSnapshot = comment.author.snapshots[0];

  return {
    id: comment.id,
    articleId: comment.articleId,
    time: comment.time.toISOString(),
    content: comment.content,
    updatedAt: comment.updatedAt.toISOString(),
    authorId: comment.authorId,
    author: {
      id: comment.author.id,
      name: authorSnapshot?.name ?? `用户${comment.author.id}`,
      badge: authorSnapshot?.badge ?? null,
      color: (authorSnapshot?.color ?? "gray").toLowerCase(),
      ccfLevel: authorSnapshot?.ccfLevel ?? 0,
      xcpcLevel: authorSnapshot?.xcpcLevel ?? 0,
    },
  };
}

function parseLimit(limitParam: string | null): number {
  if (!limitParam) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(limitParam, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(parsed, MAX_LIMIT);
}

function parseOrder(orderParam: string | null): OrderParam {
  return orderParam === "newest" ? "newest" : "oldest";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const articleId = id;

  if (!articleId || typeof articleId !== "string") {
    return NextResponse.json({ error: "Invalid article id" }, { status: 400 });
  }

  const url = new URL(request.url);
  const orderParam = parseOrder(url.searchParams.get("order"));
  const orderBy = ORDER_MAP[orderParam];
  const limit = parseLimit(url.searchParams.get("limit"));
  const skipParam = url.searchParams.get("skip");
  const skip = skipParam ? Math.max(0, Number.parseInt(skipParam, 10) || 0) : 0;

  const beforeParam = url.searchParams.get("before");
  const afterParam = url.searchParams.get("after");

  if (beforeParam && afterParam) {
    return NextResponse.json(
      { error: "Cannot use before and after together" },
      { status: 400 },
    );
  }

  try {
    if (beforeParam) {
      const beforeId = Number.parseInt(beforeParam, 10);
      if (Number.isNaN(beforeId) || beforeId <= 0) {
        return NextResponse.json(
          { error: "Invalid before cursor" },
          { status: 400 },
        );
      }

      const oppositeOrder = orderBy === "time_asc" ? "time_desc" : "time_asc";
      const results = await getArticleComments(articleId, {
        orderBy: oppositeOrder,
        takeAfterComment: beforeId,
        take: limit + 1,
        skip,
      });

      const hasMoreBefore = results.length > limit;
      const trimmed = results.slice(0, limit);
      const normalized = trimmed.slice().reverse();

      const body: CommentResponseBody = {
        items: normalized.map(mapCommentToResponse),
        hasMoreBefore,
        hasMoreAfter: true,
      };

      return NextResponse.json(body);
    }

    if (afterParam) {
      const afterId = Number.parseInt(afterParam, 10);
      if (Number.isNaN(afterId) || afterId <= 0) {
        return NextResponse.json(
          { error: "Invalid after cursor" },
          { status: 400 },
        );
      }

      const results = await getArticleComments(articleId, {
        orderBy,
        takeAfterComment: afterId,
        take: limit + 1,
        skip,
      });

      const hasMoreAfter = results.length > limit;
      const trimmed = hasMoreAfter ? results.slice(0, limit) : results;

      const body: CommentResponseBody = {
        items: trimmed.map(mapCommentToResponse),
        hasMoreBefore: true,
        hasMoreAfter,
      };

      return NextResponse.json(body);
    }

    const results = await getArticleComments(articleId, {
      orderBy,
      take: limit + 1,
      skip,
    });

    const hasMoreAfter = results.length > limit;
    const trimmed = hasMoreAfter ? results.slice(0, limit) : results;

    const body: CommentResponseBody = {
      items: trimmed.map(mapCommentToResponse),
      hasMoreBefore: false,
      hasMoreAfter,
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load comments" },
      { status: 500 },
    );
  }
}
