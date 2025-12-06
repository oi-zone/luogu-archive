import { NextResponse, type NextRequest } from "next/server";

import { EntryRef, resolveEntries } from "@luogu-discussion-archive/query";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const refs = searchParams.getAll("ref");

  return NextResponse.json(
    await resolveEntries(
      refs.map((ref) => {
        const [type, id] = ref.split(":");
        return { type, id } as EntryRef;
      }),
    ),
  );
}
