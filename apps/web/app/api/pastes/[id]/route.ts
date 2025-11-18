import { NextResponse } from "next/server";

import { getPasteWithSnapshot } from "@luogu-discussion-archive/query";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const pasteId = id?.trim();

  if (!pasteId) {
    return NextResponse.json({ error: "Invalid paste id" }, { status: 400 });
  }

  try {
    const paste = await getPasteWithSnapshot(pasteId);
    const snapshot = paste.snapshots[0];

    if (!snapshot) {
      return NextResponse.json(
        { error: "Paste snapshot not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id: paste.id,
      capturedAt: snapshot.capturedAt.toISOString(),
      lastSeenAt: snapshot.lastSeenAt.toISOString(),
      isPublic: snapshot.public,
      snapshotsCount: paste._count.snapshots,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load paste" },
      { status: 500 },
    );
  }
}
