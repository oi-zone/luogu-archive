import { NextResponse } from "next/server";

import { getPostSummaryWithLatestSnapshot } from "@luogu-discussion-archive/query";

export async function GET(
  _request: Request,
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

  try {
    const summary = await getPostSummaryWithLatestSnapshot(postId);
    if (!summary) {
      return NextResponse.json(
        { error: "Discussion not found" },
        { status: 404 },
      );
    }

    const latestSnapshot = summary.snapshots[0];

    return NextResponse.json({
      id: summary.id,
      title: latestSnapshot?.title ?? `讨论 ${summary.id}`,
      capturedAt: (latestSnapshot?.capturedAt ?? summary.time).toISOString(),
      lastSeenAt: (latestSnapshot?.lastSeenAt ?? summary.time).toISOString(),
      forum: latestSnapshot?.forum
        ? { slug: latestSnapshot.forum.slug, name: latestSnapshot.forum.name }
        : null,
      allRepliesCount: summary._count.replies,
      snapshotsCount: summary._count.snapshots,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load discussion" },
      { status: 500 },
    );
  }
}
