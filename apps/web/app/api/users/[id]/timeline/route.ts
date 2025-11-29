import { NextResponse } from "next/server";

import {
  getUserTimelinePage,
  parseUserTimelineCursor,
} from "@luogu-discussion-archive/query";

const DEFAULT_LIMIT = 30;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const userId = Number.parseInt(id, 10);

  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const cursorParam = url.searchParams.get("cursor");

  let limit = DEFAULT_LIMIT;
  if (limitParam) {
    const parsedLimit = Number.parseInt(limitParam, 10);
    if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
      return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
    }
    limit = parsedLimit;
  }

  let cursor = null;
  if (cursorParam) {
    cursor = parseUserTimelineCursor(cursorParam);
    if (!cursor) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }
  }

  try {
    const page = await getUserTimelinePage(userId, {
      limit,
      cursor,
    });

    if (!page) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(page);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load timeline" },
      { status: 500 },
    );
  }
}
