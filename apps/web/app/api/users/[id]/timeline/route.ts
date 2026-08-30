import { NextResponse } from "next/server";

import {
  getUserTimelinePage,
  parseUserTimelineCursor,
} from "@luogu-discussion-archive/query";

import {
  isBoundedCursor,
  parseBoundedLimit,
  parsePositiveDecimal,
  requestInputIsTooLarge,
} from "@/lib/request-validation";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const userId = parsePositiveDecimal(id);

  if (requestInputIsTooLarge(request)) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }
  if (userId === null) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const cursorParam = url.searchParams.get("cursor");

  const limit = parseBoundedLimit(limitParam, DEFAULT_LIMIT, MAX_LIMIT);
  if (limit === null)
    return NextResponse.json({ error: "Invalid limit" }, { status: 400 });

  let cursor = null;
  if (cursorParam) {
    if (!isBoundedCursor(cursorParam)) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }
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
  } catch {
    return NextResponse.json(
      { error: "Failed to load timeline" },
      { status: 500 },
    );
  }
}
