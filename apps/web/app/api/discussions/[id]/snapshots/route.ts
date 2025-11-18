import { NextResponse } from "next/server";

import { getPostSnapshotsTimeline } from "@luogu-discussion-archive/query";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

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
  const limitParam = url.searchParams.get("limit");
  const cursorParam = url.searchParams.get("cursor");

  let take = DEFAULT_LIMIT;
  if (limitParam) {
    const parsed = Number.parseInt(limitParam, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
    }
    take = Math.min(parsed, MAX_LIMIT);
  }

  let cursorCapturedAt: Date | undefined;
  if (cursorParam) {
    const capturedAtMillis = Number.parseInt(cursorParam, 36);
    if (Number.isNaN(capturedAtMillis) || capturedAtMillis <= 0) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }
    cursorCapturedAt = new Date(capturedAtMillis);
  }

  try {
    const timeline = await getPostSnapshotsTimeline(postId, {
      cursorCapturedAt,
      take,
    });

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
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load snapshot timeline" },
      { status: 500 },
    );
  }
}
