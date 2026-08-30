import { NextResponse, type NextRequest } from "next/server";

import {
  resolveEntries,
  validateEntryRequest,
} from "@luogu-discussion-archive/query";

const MAX_ENTRY_RESPONSE_BYTES = 1024 * 1024;

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
    const serialized = JSON.stringify(await resolveEntries(validation.refs));
    if (Buffer.byteLength(serialized, "utf8") > MAX_ENTRY_RESPONSE_BYTES) {
      return NextResponse.json(
        { error: "Entry response exceeds the configured limit" },
        { status: 500 },
      );
    }
    return new NextResponse(serialized, {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to resolve entries" },
      { status: 500 },
    );
  }
}
