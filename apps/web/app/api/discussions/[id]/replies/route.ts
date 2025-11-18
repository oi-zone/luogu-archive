import { NextResponse } from "next/server";

import { getPostRepliesWithLatestSnapshot } from "@luogu-discussion-archive/query";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

const ORDER_MAP = {
  newest: "time_desc" as const,
  oldest: "time_asc" as const,
};

type OrderParam = keyof typeof ORDER_MAP;

type ReplyResponseItem = {
  id: number;
  postId: number;
  time: string;
  content: string;
  capturedAt: string;
  lastSeenAt: string;
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

type ReplyResponseBody = {
  items: ReplyResponseItem[];
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
};

function mapReplyToResponse(
  reply: Awaited<ReturnType<typeof getPostRepliesWithLatestSnapshot>>[number],
): ReplyResponseItem {
  const latestSnapshot = reply.snapshots[0];
  const authorSnapshot = reply.author.snapshots[0];

  return {
    id: reply.id,
    postId: reply.postId,
    time: reply.time.toISOString(),
    content: latestSnapshot?.content ?? "该评论尚未保存。",
    capturedAt: (latestSnapshot?.capturedAt ?? reply.time).toISOString(),
    lastSeenAt: (latestSnapshot?.lastSeenAt ?? reply.time).toISOString(),
    authorId: reply.authorId,
    author: {
      id: reply.author.id,
      name: authorSnapshot?.name ?? `用户${reply.author.id}`,
      badge: authorSnapshot?.badge ?? null,
      color: (authorSnapshot?.color ?? "gray").toLowerCase(),
      ccfLevel: authorSnapshot?.ccfLevel ?? 0,
      xcpcLevel: authorSnapshot?.xcpcLevel ?? 0,
    },
    snapshotsCount: reply._count.snapshots,
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
  const postId = Number.parseInt(id, 10);

  if (Number.isNaN(postId) || postId <= 0) {
    return NextResponse.json(
      { error: "Invalid discussion id" },
      { status: 400 },
    );
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
      const results = await getPostRepliesWithLatestSnapshot(postId, {
        orderBy: oppositeOrder,
        takeAfterReply: beforeId,
        take: limit + 1,
        skip,
      });

      const hasMoreBefore = results.length > limit;
      const trimmed = results.slice(0, limit);
      const normalized = trimmed.slice().reverse();

      const body: ReplyResponseBody = {
        items: normalized.map(mapReplyToResponse),
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

      const results = await getPostRepliesWithLatestSnapshot(postId, {
        orderBy,
        takeAfterReply: afterId,
        take: limit + 1,
        skip,
      });

      const hasMoreAfter = results.length > limit;
      const trimmed = hasMoreAfter ? results.slice(0, limit) : results;

      const body: ReplyResponseBody = {
        items: trimmed.map(mapReplyToResponse),
        hasMoreBefore: true,
        hasMoreAfter,
      };

      return NextResponse.json(body);
    }

    const results = await getPostRepliesWithLatestSnapshot(postId, {
      orderBy,
      take: limit + 1,
      skip,
    });

    const hasMoreAfter = results.length > limit;
    const trimmed = hasMoreAfter ? results.slice(0, limit) : results;

    const body: ReplyResponseBody = {
      items: trimmed.map(mapReplyToResponse),
      hasMoreBefore: false,
      hasMoreAfter,
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load replies" },
      { status: 500 },
    );
  }
}
