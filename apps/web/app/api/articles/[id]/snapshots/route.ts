import { NextResponse } from "next/server";

import { getArticleSnapshotsTimeline } from "@luogu-discussion-archive/query";

import {
  isArticleId,
  parseBase36Millis,
  parseBoundedLimit,
  requestInputIsTooLarge,
} from "@/lib/request-validation";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const articleId = id?.trim();

  if (requestInputIsTooLarge(request)) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }
  if (!articleId || !isArticleId(articleId)) {
    return NextResponse.json({ error: "Invalid article id" }, { status: 400 });
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
    const timeline = await getArticleSnapshotsTimeline(articleId, {
      cursorCapturedAt,
      take,
    });
    if (!timeline) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    return NextResponse.json({
      items: timeline.items.map((item) => ({
        snapshotId: item.capturedAt.getTime().toString(36),
        capturedAt: item.capturedAt.toISOString(),
        lastSeenAt: item.lastSeenAt.toISOString(),
        title: item.title,
        category: item.category,
        status: item.status,
        solutionFor: item.solutionFor,
        collection: item.collection,
        promoteStatus: item.promoteStatus,
        adminNote: item.adminNote,
        changedFields: item.changedFields,
        hasPrevious: item.hasPrevious,
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
