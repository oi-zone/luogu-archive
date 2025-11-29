import { NextResponse } from "next/server";

import {
  getGlobalOstrakonPage,
  parseOstrakonCursor,
} from "@luogu-discussion-archive/query";

const DEFAULT_LIMIT = 50;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const cursorParam = url.searchParams.get("cursor");

  let limit = DEFAULT_LIMIT;
  if (limitParam) {
    const parsed = Number.parseInt(limitParam, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
    }
    limit = parsed;
  }

  let cursor = null;
  if (cursorParam) {
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
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load ostraka" },
      { status: 500 },
    );
  }
}
