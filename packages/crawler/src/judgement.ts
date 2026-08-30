import type { RouteResponse } from "@lgjs/types";

import { db, schema, sql } from "@luogu-discussion-archive/db";

import { publicCn } from "./client.js";
import { expectArray, expectRecord } from "./http.js";
import { saveUserSnapshots } from "./user.js";

export async function fetchJudgement() {
  // Here we don't have the server time, so just use local time
  const now = new Date();

  const { data } = await publicCn.getJson(
    "judgement",
    {},
    {
      endpoint: "judgement",
      timeoutMs: 20_000,
      maxBytes: 2 * 1024 * 1024,
      validate(value) {
        const root = expectRecord(value, "judgement");
        const payload =
          "data" in root ? expectRecord(root.data, "judgement") : root;
        return {
          logs: expectArray<RouteResponse["judgement"]["data"]["logs"][number]>(
            payload.logs,
            "judgement.logs",
            500,
          ),
        };
      },
    },
  );
  const { logs } = data;

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
