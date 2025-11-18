import { NextResponse } from "next/server";

import { getArticleWithSnapshot } from "@luogu-discussion-archive/query";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const articleId = id?.trim();

  if (!articleId) {
    return NextResponse.json({ error: "Invalid article id" }, { status: 400 });
  }

  try {
    const article = await getArticleWithSnapshot(articleId);
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
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load article" },
      { status: 500 },
    );
  }
}
