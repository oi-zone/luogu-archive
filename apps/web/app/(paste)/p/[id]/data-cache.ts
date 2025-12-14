import { cache } from "react";

import { getPasteWithSnapshot } from "@luogu-discussion-archive/query";

export const getPasteData = cache(async (id: string, snapshot?: Date) => {
  let pasteWithSnapshot;

  try {
    pasteWithSnapshot = await getPasteWithSnapshot(id, snapshot);
  } catch {
    return null;
  }

  if (pasteWithSnapshot === null) {
    return null;
  }

  // if (pasteWithSnapshot.takedown) {
  //   throw new Error("Paste taken down");
  // }

  return {
    id,
    time: pasteWithSnapshot.time,
    public: pasteWithSnapshot.snapshots[0].public,
    content: pasteWithSnapshot.snapshots[0].data,
    capturedAt: pasteWithSnapshot.snapshots[0].capturedAt,
    lastSeenAt: pasteWithSnapshot.snapshots[0].lastSeenAt,
    author: {
      id: pasteWithSnapshot.userId,
      name: pasteWithSnapshot.user.snapshots[0].name,
      badge: pasteWithSnapshot.user.snapshots[0].badge,
      color: pasteWithSnapshot.user.snapshots[0].color,
      ccfLevel: pasteWithSnapshot.user.snapshots[0].ccfLevel,
      xcpcLevel: pasteWithSnapshot.user.snapshots[0].xcpcLevel,
    },
    snapshotsCount: pasteWithSnapshot._count.snapshots,
  };
});
