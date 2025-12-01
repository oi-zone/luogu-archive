import { NextResponse } from "next/server";

import { getProblemBasicInfo } from "@luogu-discussion-archive/query";

export async function GET(
  _request: Request,
  context: { params: Promise<{ pid: string }> },
) {
  const { pid } = await context.params;
  const problemId = pid?.trim();

  if (!problemId) {
    return NextResponse.json({ error: "Invalid problem id" }, { status: 400 });
  }

  try {
    const problem = await getProblemBasicInfo(problemId);

    if (!problem) {
      return NextResponse.json({ error: "Problem not found" }, { status: 404 });
    }

    return NextResponse.json({
      pid: problem.pid,
      title: problem.title,
      difficulty: problem.difficulty,
      solutionsCount: problem.solutionsCount,
      updatedAt: problem.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Failed to load problem", error);
    return NextResponse.json(
      { error: "Failed to load problem" },
      { status: 500 },
    );
  }
}
