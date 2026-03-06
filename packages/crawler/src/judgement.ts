import type { RouteResponse } from "@lgjs/types";

import { db, schema, sql } from "@luogu-discussion-archive/db";

import { cn } from "./client.js";
import { HttpError } from "./error.js";
import { saveUserSnapshots } from "./user.js";

export async function fetchJudgement() {
  // Here we don't have the server time, so just use local time
  const now = new Date();

  const res = await cn.get("judgement");
  const { logs } = await (
    res.json() as Promise<RouteResponse["judgement"]["data"]>
  ).catch((err: unknown) => {
    throw res.ok ? err : new HttpError(res);
  });

  await saveUserSnapshots(
    logs.map((log) => log.user),
    now,
  );
  return db
    .insert(schema.Judgement)
    .values(
      logs.map((log) => ({
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
