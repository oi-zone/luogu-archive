import {
  and,
  count,
  db,
  desc,
  eq,
  inArray,
  lt,
  schema,
  sql,
} from "@luogu-discussion-archive/db";

import type { PasteDto } from "./dto.js";
import { getLuoguAvatar } from "./user-profile.js";

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

export async function getPasteEntries(ids: string[]): Promise<PasteDto[]> {
  const pastes = await db.query.Paste.findMany({
    where: inArray(schema.Paste.id, ids),
    with: {
      snapshots: {
        orderBy: desc(schema.PasteSnapshot.capturedAt),
        limit: 1,
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
    extras: {
      snapshotCount: db
        .$count(
          schema.PasteSnapshot,
          eq(
            schema.Paste.id,
            sql`${schema.PasteSnapshot}.${sql.identifier(schema.PasteSnapshot.pasteId.name)}`,
          ),
        )
        .as("snapshot_count"),
    },
  });

  return pastes.flatMap((paste) =>
    paste.snapshots.flatMap((snapshot) =>
      paste.user.snapshots.map((userSnapshot) => ({
        id: paste.id,
        data: snapshot.data ?? "",
        time: paste.time.getTime() / 1000,
        public: snapshot.public,
        user: {
          ...userSnapshot,
          uid: userSnapshot.userId,
          avatar: getLuoguAvatar(userSnapshot.userId),
        },
        snapshotCount: paste.snapshotCount,
      })),
    ),
  );
}
