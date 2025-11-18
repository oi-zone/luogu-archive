import { NextResponse } from "next/server";

import { getUserWithLatestSnapshot } from "@luogu-discussion-archive/query";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: idParam } = await context.params;
  const id = Number.parseInt(idParam, 10);

  if (Number.isNaN(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  try {
    const user = await getUserWithLatestSnapshot(id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const snapshot = user.snapshots[0];

    return NextResponse.json({
      id: user.id,
      name: snapshot?.name ?? `用户${user.id}`,
      badge: snapshot?.badge ?? null,
      color: (snapshot?.color ?? "gray").toLowerCase(),
      ccfLevel: snapshot?.ccfLevel ?? 0,
      xcpcLevel: snapshot?.xcpcLevel ?? 0,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 });
  }
}
