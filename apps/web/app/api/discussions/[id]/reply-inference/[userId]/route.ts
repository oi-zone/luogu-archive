import { NextResponse } from "next/server";

import { getPostUserReplyInference } from "@luogu-discussion-archive/query";

type ReplyPayload = {
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

type ReplyInferenceResponse = {
  reply: ReplyPayload;
  previousReplyId: number | null;
  nextReplyId: number | null;
  hasPrevious: boolean;
  hasNext: boolean;
};

function mapReplyToPayload(
  reply: NonNullable<
    Awaited<ReturnType<typeof getPostUserReplyInference>>["current"]
  >,
): ReplyPayload {
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

function parsePositiveInt(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parseOptionalPositiveInt(value: string | null): {
  provided: boolean;
  value: number | undefined;
  valid: boolean;
} {
  if (value === null) {
    return { provided: false, value: undefined, valid: true };
  }

  const parsed = parsePositiveInt(value);
  if (parsed === null) {
    return { provided: true, value: undefined, valid: false };
  }

  return { provided: true, value: parsed, valid: true };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; userId: string }> },
) {
  const { id, userId } = await context.params;

  const postId = parsePositiveInt(id);
  const targetUserId = parsePositiveInt(userId);

  if (!postId || !targetUserId) {
    return NextResponse.json(
      { error: "Invalid discussion or user id" },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const cursorParse = parseOptionalPositiveInt(url.searchParams.get("cursor"));
  const relativeParse = parseOptionalPositiveInt(
    url.searchParams.get("relativeTo"),
  );

  if (!cursorParse.valid || !relativeParse.valid) {
    return NextResponse.json(
      { error: "Invalid cursor parameters" },
      { status: 400 },
    );
  }

  try {
    const result = await getPostUserReplyInference({
      postId,
      userId: targetUserId,
      ...(cursorParse.value ? { cursorReplyId: cursorParse.value } : {}),
      ...(relativeParse.value
        ? { relativeToReplyId: relativeParse.value }
        : {}),
    });

    if (!result.current) {
      return NextResponse.json(
        { error: "No reply found for the requested user" },
        { status: 404 },
      );
    }

    const body: ReplyInferenceResponse = {
      reply: mapReplyToPayload(result.current),
      previousReplyId: result.previousReplyId,
      nextReplyId: result.nextReplyId,
      hasPrevious: Boolean(result.previousReplyId),
      hasNext: Boolean(result.nextReplyId),
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to infer replies" },
      { status: 500 },
    );
  }
}
