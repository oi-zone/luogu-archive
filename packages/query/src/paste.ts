import { prisma } from "@luogu-discussion-archive/db";

export async function getPasteWithSnapshot(id: string, capturedAt?: Date) {
  const pastePromise = prisma.paste.findUnique({
    where: { id },
    include: {
      snapshots: {
        ...(capturedAt ? { where: { capturedAt } } : {}),
        orderBy: { capturedAt: "desc" },
        take: 1,
      },
      user: {
        include: {
          snapshots: {
            orderBy: { capturedAt: "desc" },
            take: 1,
          },
        },
      },
      _count: {
        select: {
          snapshots: true,
        },
      },
    },
  });

  const paste = await pastePromise;

  if (!paste) throw new Error("Paste not found");

  return paste;
}

type PasteSnapshotChangedField = "content" | "visibility";

interface PasteSnapshotTimelineResult {
  capturedAt: Date;
  lastSeenAt: Date;
  isPublic: boolean;
  changedFields: PasteSnapshotChangedField[];
  hasPrevious: boolean;
}

export async function getPasteSnapshotsTimeline(
  pasteId: string,
  {
    cursorCapturedAt,
    take = 10,
  }: {
    cursorCapturedAt?: Date;
    take?: number;
  } = {},
): Promise<{
  items: PasteSnapshotTimelineResult[];
  hasMore: boolean;
  nextCursor: Date | null;
}> {
  const snapshots = await prisma.pasteSnapshot.findMany({
    where: { pasteId },
    orderBy: { capturedAt: "desc" },
    ...(cursorCapturedAt
      ? {
          cursor: {
            pasteId_capturedAt: {
              pasteId,
              capturedAt: cursorCapturedAt,
            },
          },
          skip: 1,
        }
      : {}),
    take: take + 1,
  });

  if (snapshots.length === 0) {
    return {
      items: [],
      hasMore: false,
      nextCursor: null,
    };
  }

  const hasMore = snapshots.length > take;
  const trimmed = hasMore ? snapshots.slice(0, take) : snapshots;

  const items: PasteSnapshotTimelineResult[] = trimmed.map(
    (snapshot, index) => {
      const previous = snapshots[index + 1];
      const changedFields: PasteSnapshotChangedField[] = [];

      if (previous) {
        if ((snapshot.data ?? "") !== (previous.data ?? "")) {
          changedFields.push("content");
        }

        if (snapshot.public !== previous.public) {
          changedFields.push("visibility");
        }
      }

      return {
        capturedAt: snapshot.capturedAt,
        lastSeenAt: snapshot.lastSeenAt,
        isPublic: snapshot.public,
        changedFields,
        hasPrevious: Boolean(previous),
      };
    },
  );

  const lastItem = trimmed.length > 0 ? trimmed[trimmed.length - 1] : undefined;

  return {
    items,
    hasMore,
    nextCursor: hasMore && lastItem ? lastItem.capturedAt : null,
  };
}
