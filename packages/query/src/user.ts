import { db, desc, inArray, schema, sql } from "@luogu-discussion-archive/db";

import type { PublicUserPreviewDto } from "./dto.js";
import { getLuoguAvatar } from "./user-profile.js";

export async function getUserEntries(
  ids: number[],
): Promise<PublicUserPreviewDto[]> {
  if (ids.length === 0) return [];

  const users = await db.query.User.findMany({
    with: {
      snapshots: {
        columns: {
          name: false,
          badge: false,
          color: true,
          ccfLevel: true,
          xcpcLevel: true,
        },
        extras: {
          name: sql<string>`left(${schema.UserSnapshot.name}, 128)`.as(
            "entry_user_name",
          ),
          badge: sql<string | null>`left(${schema.UserSnapshot.badge}, 128)`.as(
            "entry_user_badge",
          ),
        },
        orderBy: desc(schema.UserSnapshot.capturedAt),
        limit: 1,
      },
    },
    where: inArray(schema.User.id, ids),
    orderBy: schema.User.id,
  });

  return users.flatMap((user) =>
    user.snapshots.map((snapshot) => ({
      uid: user.id,
      avatar: getLuoguAvatar(user.id),
      name: snapshot.name,
      badge: snapshot.badge,
      color: snapshot.color,
      ccfLevel: snapshot.ccfLevel,
      xcpcLevel: snapshot.xcpcLevel,
    })),
  );
}
