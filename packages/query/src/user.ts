import { db, desc, eq, inArray, schema } from "@luogu-discussion-archive/db";

import type { UserDto } from "./dto.js";
import { getLuoguAvatar } from "./user-profile.js";

export async function getUserWithLatestSnapshot(id: number) {
  return db.query.User.findFirst({
    where: eq(schema.User.id, id),
    with: {
      snapshots: {
        orderBy: desc(schema.UserSnapshot.capturedAt),
        limit: 1,
      },
    },
  });
}

export async function getUserEntries(ids: number[]): Promise<UserDto[]> {
  const users = await db.query.User.findMany({
    with: {
      snapshots: {
        orderBy: desc(schema.UserSnapshot.capturedAt),
        limit: 1,
      },
    },
    where: inArray(schema.User.id, ids),
    orderBy: schema.User.id,
  });

  return users.flatMap((user) =>
    user.snapshots.map((snapshot) => ({
      ...snapshot,
      uid: user.id,
      avatar: getLuoguAvatar(user.id),
    })),
  );
}
