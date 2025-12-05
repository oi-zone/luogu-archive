import { db, desc, eq, inArray, schema } from "@luogu-discussion-archive/db";

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

export async function getUsers(uids: number[]) {
  const users = await db.query.User.findMany({
    where: inArray(schema.User.id, uids),
    with: {
      snapshots: {
        orderBy: desc(schema.UserSnapshot.capturedAt),
        limit: 1,
      },
    },
  });

  return users.flatMap((user) =>
    user.snapshots.flatMap((snapshot) => ({
      uid: user.id,
      ...snapshot,
    })),
  );
}

export async function resolveUsers(uids: number[]) {
  const users = await getUsers(uids);
  return uids.map((uid) => ({
    data: users.find((user) => user.uid === uid) ?? null,
  }));
}
