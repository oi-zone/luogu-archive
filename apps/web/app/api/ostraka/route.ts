import { NextResponse } from "next/server";

import {
  getGlobalOstrakonPage,
  parseOstrakonCursor,
} from "@luogu-discussion-archive/query";

import {
  isBoundedCursor,
  parseBoundedLimit,
  requestInputIsTooLarge,
} from "@/lib/request-validation";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const cursorParam = url.searchParams.get("cursor");

  if (requestInputIsTooLarge(request)) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  const limit = parseBoundedLimit(limitParam, DEFAULT_LIMIT, MAX_LIMIT);
  if (limit === null)
    return NextResponse.json({ error: "Invalid limit" }, { status: 400 });

  let cursor = null;
  if (cursorParam) {
    if (!isBoundedCursor(cursorParam)) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }
    cursor = parseOstrakonCursor(cursorParam);
    if (!cursor) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }
  }

  try {
    const page = await getGlobalOstrakonPage({
      limit,
      cursor,
    });

    return NextResponse.json(page);
  } catch {
    return NextResponse.json(
      { error: "Failed to load ostraka" },
      { status: 500 },
    );
  }
}
