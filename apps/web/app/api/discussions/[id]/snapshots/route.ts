import { NextResponse } from "next/server";

import { getPostSnapshotsTimeline } from "@luogu-discussion-archive/query";

import {
  parseBase36Millis,
  parseBoundedLimit,
  parsePositiveDecimal,
  requestInputIsTooLarge,
} from "@/lib/request-validation";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const postId = parsePositiveDecimal(id);

  if (requestInputIsTooLarge(request)) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }
  if (postId === null) {
    return NextResponse.json(
      { error: "Invalid discussion id" },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const cursorParam = url.searchParams.get("cursor");

  const take = parseBoundedLimit(limitParam, DEFAULT_LIMIT, MAX_LIMIT);
  if (take === null)
    return NextResponse.json({ error: "Invalid limit" }, { status: 400 });

  let cursorCapturedAt: Date | undefined;
  if (cursorParam) {
    const parsed = parseBase36Millis(cursorParam);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }
    cursorCapturedAt = parsed;
  }

  try {
    const timeline = await getPostSnapshotsTimeline(postId, {
      cursorCapturedAt,
      take,
    });
    if (!timeline) {
      return NextResponse.json(
        { error: "Discussion not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      items: timeline.items.map((item) => ({
        snapshotId: item.capturedAt.getTime().toString(36),
        capturedAt: item.capturedAt.toISOString(),
        lastSeenAt: item.lastSeenAt.toISOString(),
        title: item.title,
        hasPrevious: item.hasPrevious,
        author: item.author
          ? {
              id: item.author.id,
              name: item.author.name,
              badge: item.author.badge,
              color: item.author.color,
              ccfLevel: item.author.ccfLevel,
              xcpcLevel: item.author.xcpcLevel,
            }
          : null,
        forum: item.forum,
        changedFields: item.changedFields,
      })),
      hasMore: timeline.hasMore,
      nextCursor: timeline.nextCursor
        ? timeline.nextCursor.getTime().toString(36)
        : null,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load snapshot timeline" },
      { status: 500 },
    );
  }
}
