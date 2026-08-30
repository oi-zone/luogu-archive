import { NextResponse } from "next/server";

import { getArticleComment } from "@luogu-discussion-archive/query";

import {
  isArticleId,
  parsePositiveDecimal,
  requestInputIsTooLarge,
} from "@/lib/request-validation";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; commentId: string }> },
) {
  const { id, commentId: commentIdParam } = await context.params;
  const commentId = parsePositiveDecimal(commentIdParam);

  if (requestInputIsTooLarge(request)) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }
  if (!isArticleId(id)) {
    return NextResponse.json({ error: "Invalid article id" }, { status: 400 });
  }

  if (commentId === null) {
    return NextResponse.json({ error: "Invalid comment id" }, { status: 400 });
  }

  try {
    const comment = await getArticleComment(commentId);
    if (!comment || comment.articleId !== id) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const authorSnapshot = comment.author.snapshots[0];

    return NextResponse.json({
      id: comment.id,
      articleId: comment.articleId,
      time: comment.time.toISOString(),
      content: comment.content,
      updatedAt: comment.updatedAt.toISOString(),
      authorId: comment.authorId,
      author: {
        id: comment.author.id,
        name: authorSnapshot?.name ?? `用户${comment.author.id}`,
        badge: authorSnapshot?.badge ?? null,
        color: (authorSnapshot?.color ?? "gray").toLowerCase(),
        ccfLevel: authorSnapshot?.ccfLevel ?? 0,
        xcpcLevel: authorSnapshot?.xcpcLevel ?? 0,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load comment" },
      { status: 500 },
    );
  }
}
