import { NextResponse, type NextRequest } from "next/server";

import {
  resolveEntries,
  validateEntryRequest,
} from "@luogu-discussion-archive/query";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const inputBytes = new TextEncoder().encode(request.url).byteLength;
  const refs = searchParams.getAll("entry-ref");
  const validation = validateEntryRequest(refs, inputBytes);
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error },
      { status: validation.status },
    );
  }

  try {
    return NextResponse.json(await resolveEntries(validation.refs));
  } catch {
    return NextResponse.json(
      { error: "Failed to resolve entries" },
      { status: 500 },
    );
  }
}
