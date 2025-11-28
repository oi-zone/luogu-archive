import { db, schema, sql } from "@luogu-discussion-archive/db/drizzle";

import { cn } from "./client.js";
import { HttpError } from "./error.js";
import { saveUserSnapshots } from "./user.js";

export async function fetchJudgement() {
  const res = await cn.get("judgement");
  const { status, data, time } = await res.json().catch((err: unknown) => {
    throw res.ok ? err : new HttpError(res);
  });
  if (status !== 200) throw new HttpError(res);

  const now = new Date(time * 1000);
  await saveUserSnapshots(
    data.logs.map((log) => log.user),
    now,
  );
  return db
    .insert(schema.Judgement)
    .values(
      data.logs.map((log) => ({
        userId: log.user.uid,
        reason: log.reason,
        revokedPermission: log.revokedPermission,
        addedPermission: log.addedPermission,
        time: new Date(log.time * 1000),
      })),
    )
    .onConflictDoUpdate({
      target: [schema.Judgement.time, schema.Judgement.userId],
      set: {
        reason: sql.raw(`excluded."${schema.Judgement.reason.name}"`),
        revokedPermission: sql.raw(
          `excluded."${schema.Judgement.revokedPermission.name}"`,
        ),
        addedPermission: sql.raw(
          `excluded."${schema.Judgement.addedPermission.name}"`,
        ),
      },
    });
}
