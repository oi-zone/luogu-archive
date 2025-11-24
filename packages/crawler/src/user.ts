import type { UserSummary } from "@lgjs/types";

import {
  and,
  db,
  eq,
  isNull,
  max,
  schema,
  sql,
} from "@luogu-discussion-archive/db/drizzle";

import { PgAdvisoryLock } from "./locks.js";
import { deduplicate } from "./utils.js";

const saveUsers = (uids: number[]) =>
  db
    .insert(schema.User)
    .values(uids.map((uid) => ({ id: uid })))
    .onConflictDoNothing()
    .execute();

const saveUserSnapshot = (user: UserSummary, now: Date) =>
  db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(${PgAdvisoryLock.User}::int4, ${user.uid}::int4)`,
    );

    const lastCaptured = tx
      .select({ val: max(schema.UserSnapshot.capturedAt) })
      .from(schema.UserSnapshot)
      .where(eq(schema.UserSnapshot.userId, user.uid));

    const { rowCount } = await tx
      .update(schema.UserSnapshot)
      .set({ lastSeenAt: now })
      .where(
        and(
          eq(schema.UserSnapshot.userId, user.uid),
          eq(schema.UserSnapshot.capturedAt, lastCaptured),

          eq(schema.UserSnapshot.name, user.name),
          eq(schema.UserSnapshot.slogan, user.slogan ?? ""),
          user.badge !== null
            ? eq(schema.UserSnapshot.badge, user.badge)
            : isNull(schema.UserSnapshot.badge),
          eq(schema.UserSnapshot.isAdmin, user.isAdmin),
          eq(schema.UserSnapshot.isBanned, user.isBanned),
          eq(schema.UserSnapshot.isRoot, user.isRoot ?? false),
          eq(schema.UserSnapshot.color, user.color),
          eq(schema.UserSnapshot.ccfLevel, user.ccfLevel),
          eq(schema.UserSnapshot.xcpcLevel, user.xcpcLevel),
          eq(schema.UserSnapshot.background, user.background ?? ""),
        ),
      );

    if (rowCount === 0)
      return tx.insert(schema.UserSnapshot).values({
        userId: user.uid,
        name: user.name,
        slogan: user.slogan ?? "",
        badge: user.badge,
        isAdmin: user.isAdmin,
        isBanned: user.isBanned,
        isRoot: user.isRoot ?? false,
        color: user.color,
        ccfLevel: user.ccfLevel,
        xcpcLevel: user.xcpcLevel,
        background: user.background ?? "",
        capturedAt: now,
        lastSeenAt: now,
      });
  });

export async function saveUserSnapshots(users: UserSummary[], now: Date) {
  const deduplicatedUsers = deduplicate(users, (user) => user.uid);
  if (!deduplicatedUsers.length) return;

  await saveUsers(deduplicatedUsers.map((user) => user.uid));
  await Promise.all(
    deduplicatedUsers.map((user) => saveUserSnapshot(user, now)),
  );
}
