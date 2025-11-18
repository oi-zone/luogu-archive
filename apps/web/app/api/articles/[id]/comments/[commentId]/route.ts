import { NextResponse } from "next/server";

import { getArticleComment } from "@luogu-discussion-archive/query";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; commentId: string }> },
) {
  const { id, commentId: commentIdParam } = await context.params;
  const commentId = Number.parseInt(commentIdParam, 10);

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid article id" }, { status: 400 });
  }

  if (Number.isNaN(commentId) || commentId <= 0) {
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
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load comment" },
      { status: 500 },
    );
  }
}
