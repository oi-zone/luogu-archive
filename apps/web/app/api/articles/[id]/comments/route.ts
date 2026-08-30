import { NextResponse } from "next/server";

import { getArticleComments } from "@luogu-discussion-archive/query";

import {
  isArticleId,
  parseBoundedLimit,
  parseNonNegativeDecimal,
  parsePositiveDecimal,
  requestInputIsTooLarge,
} from "@/lib/request-validation";

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

function parseOrder(orderParam: string | null): OrderParam | null {
  if (orderParam === null || orderParam === "oldest") return "oldest";
  return orderParam === "newest" ? "newest" : null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const articleId = id;

  if (requestInputIsTooLarge(request)) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }
  if (!isArticleId(articleId)) {
    return NextResponse.json({ error: "Invalid article id" }, { status: 400 });
  }

  const url = new URL(request.url);
  const orderParam = parseOrder(url.searchParams.get("order"));
  if (!orderParam) {
    return NextResponse.json({ error: "Invalid order" }, { status: 400 });
  }
  const orderBy = ORDER_MAP[orderParam];
  const limit = parseBoundedLimit(
    url.searchParams.get("limit"),
    DEFAULT_LIMIT,
    MAX_LIMIT,
  );
  if (limit === null) {
    return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
  }
  const skipParam = url.searchParams.get("skip");
  const skip = skipParam ? parseNonNegativeDecimal(skipParam) : 0;
  if (skip === null) {
    return NextResponse.json({ error: "Invalid skip" }, { status: 400 });
  }

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
      const beforeId = parsePositiveDecimal(beforeParam);
      if (beforeId === null) {
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
      const afterId = parsePositiveDecimal(afterParam);
      if (afterId === null) {
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
  } catch {
    return NextResponse.json(
      { error: "Failed to load comments" },
      { status: 500 },
    );
  }
}
