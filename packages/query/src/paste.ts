import {
  and,
  count,
  db,
  desc,
  eq,
  lt,
  schema,
} from "@luogu-discussion-archive/db";

export async function getPasteWithSnapshot(id: string, capturedAt?: Date) {
  const paste = await db.query.Paste.findFirst({
    where: eq(schema.Paste.id, id),
    with: {
      snapshots: {
        orderBy: desc(schema.PasteSnapshot.capturedAt),
        limit: 1,
        ...(capturedAt
          ? { where: eq(schema.PasteSnapshot.capturedAt, capturedAt) }
          : {}),
      },
      user: {
        with: {
          snapshots: {
            orderBy: desc(schema.UserSnapshot.capturedAt),
            limit: 1,
          },
        },
      },
    },
  });

  if (!paste) throw new Error("Paste not found");

  const [snapshotCountRow] = await db
    .select({ snapshotCount: count() })
    .from(schema.PasteSnapshot)
    .where(eq(schema.PasteSnapshot.pasteId, id));
  const snapshotCount = snapshotCountRow?.snapshotCount ?? 0;

  return {
    ...paste,
    _count: {
      snapshots: snapshotCount,
    },
  };
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
  const snapshots = await db.query.PasteSnapshot.findMany({
    where: cursorCapturedAt
      ? and(
          eq(schema.PasteSnapshot.pasteId, pasteId),
          lt(schema.PasteSnapshot.capturedAt, cursorCapturedAt),
        )
      : eq(schema.PasteSnapshot.pasteId, pasteId),
    orderBy: desc(schema.PasteSnapshot.capturedAt),
    limit: take + 1,
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
