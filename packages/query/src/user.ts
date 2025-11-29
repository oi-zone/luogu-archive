import { db, desc, eq, schema } from "@luogu-discussion-archive/db/drizzle";

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
