import { NextResponse } from "next/server";

import { getArticleWithSnapshot } from "@luogu-discussion-archive/query";

import { isArticleId, requestInputIsTooLarge } from "@/lib/request-validation";

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

  try {
    const article = await getArticleWithSnapshot(articleId);
    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }
    const snapshot = article.snapshots[0];

    if (!snapshot) {
      return NextResponse.json(
        { error: "Article snapshot not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id: article.lid,
      title: snapshot.title,
      capturedAt: snapshot.capturedAt.toISOString(),
      lastSeenAt: snapshot.lastSeenAt.toISOString(),
      allRepliesCount: article._count.replies,
      snapshotsCount: article._count.snapshots,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load article" },
      { status: 500 },
    );
  }
}
