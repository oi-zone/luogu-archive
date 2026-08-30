import { NextResponse } from "next/server";

import { getReplyWithLatestSnapshot } from "@luogu-discussion-archive/query";

import {
  parsePositiveDecimal,
  requestInputIsTooLarge,
} from "@/lib/request-validation";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; replyId: string }> },
) {
  const { id, replyId: replyIdParam } = await context.params;
  const postId = parsePositiveDecimal(id);
  const replyId = parsePositiveDecimal(replyIdParam);

  if (requestInputIsTooLarge(_request)) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }
  if (postId === null) {
    return NextResponse.json(
      { error: "Invalid discussion id" },
      { status: 400 },
    );
  }

  if (replyId === null) {
    return NextResponse.json({ error: "Invalid reply id" }, { status: 400 });
  }

  try {
    const reply = await getReplyWithLatestSnapshot(replyId);
    if (!reply || reply.post?.id !== postId) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 });
    }

    const latestSnapshot = reply.snapshots[0];
    const authorSnapshot = reply.author.snapshots[0];

    return NextResponse.json({
      id: reply.id,
      postId: reply.postId,
      time: reply.time.toISOString(),
      content: latestSnapshot?.content ?? "",
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
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load reply" },
      { status: 500 },
    );
  }
}
