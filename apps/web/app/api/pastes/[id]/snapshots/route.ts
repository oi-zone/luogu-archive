import { NextResponse } from "next/server";

import { getPasteSnapshotsTimeline } from "@luogu-discussion-archive/query";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const pasteId = id?.trim();

  if (!pasteId) {
    return NextResponse.json({ error: "Invalid paste id" }, { status: 400 });
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
    const timeline = await getPasteSnapshotsTimeline(pasteId, {
      cursorCapturedAt,
      take,
    });

    return NextResponse.json({
      items: timeline.items.map((item) => ({
        snapshotId: item.capturedAt.getTime().toString(36),
        capturedAt: item.capturedAt.toISOString(),
        lastSeenAt: item.lastSeenAt.toISOString(),
        isPublic: item.isPublic,
        changedFields: item.changedFields,
        hasPrevious: item.hasPrevious,
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
