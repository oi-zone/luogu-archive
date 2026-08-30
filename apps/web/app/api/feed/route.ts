import { NextResponse } from "next/server";

import { getFeedPage, parseFeedCursor } from "@luogu-discussion-archive/query";

import {
  isBoundedCursor,
  parseBoundedLimit,
  requestInputIsTooLarge,
} from "@/lib/request-validation";

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const cursorParam = url.searchParams.get("cursor");

  if (requestInputIsTooLarge(request)) {
    return NextResponse.json({ error: "REQUEST_TOO_LARGE" }, { status: 413 });
  }

  const limit = parseBoundedLimit(limitParam, DEFAULT_LIMIT, MAX_LIMIT);
  if (limit === null) {
    return NextResponse.json({ error: "INVALID_LIMIT" }, { status: 400 });
  }

  const cursor =
    cursorParam && isBoundedCursor(cursorParam)
      ? parseFeedCursor(cursorParam)
      : null;
  if (cursorParam && (!isBoundedCursor(cursorParam) || !cursor)) {
    return NextResponse.json({ error: "INVALID_CURSOR" }, { status: 400 });
  }

  const page = await getFeedPage({ limit, cursor });
  return NextResponse.json(page);
}
