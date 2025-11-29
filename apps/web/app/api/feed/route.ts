import { NextResponse } from "next/server";

import { getFeedPage, parseFeedCursor } from "@luogu-discussion-archive/query";

const DEFAULT_LIMIT = 40;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const cursorParam = url.searchParams.get("cursor");

  const limit = parseLimit(limitParam);
  if (limit === null) {
    return NextResponse.json({ error: "INVALID_LIMIT" }, { status: 400 });
  }

  const cursor = cursorParam ? parseFeedCursor(cursorParam) : null;
  if (cursorParam && !cursor) {
    return NextResponse.json({ error: "INVALID_CURSOR" }, { status: 400 });
  }

  const page = await getFeedPage({ limit: limit ?? DEFAULT_LIMIT, cursor });
  return NextResponse.json(page);
}

function parseLimit(raw: string | null) {
  if (!raw) return undefined;
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value <= 0) {
    return null;
  }
  return value;
}
