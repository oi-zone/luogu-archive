import type { RouteResponse } from "@lgjs/types";

import { db, schema, sql } from "@luogu-discussion-archive/db";

import { publicCn } from "./client.js";
import {
  expectArray,
  expectFiniteNumber,
  expectPositiveInteger,
  expectRecord,
  expectString,
  validateBoundedPayload,
} from "./http.js";
import { validateUserSummary } from "./payload-validation.js";
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
        validateBoundedPayload(value, "judgement");
        const root = expectRecord(value, "judgement");
        const payload =
          "data" in root ? expectRecord(root.data, "judgement") : root;
        const logs = expectArray<unknown>(
          payload.logs,
          "judgement.logs",
          500,
        ).map((value, index) => {
          const endpoint = `judgement.logs[${String(index)}]`;
          const log = expectRecord(value, endpoint);
          validateUserSummary(log.user, `${endpoint}.user`);
          expectString(log.reason, `${endpoint}.reason`, 4_096);
          expectFiniteNumber(
            log.revokedPermission,
            `${endpoint}.revokedPermission`,
          );
          expectFiniteNumber(
            log.addedPermission,
            `${endpoint}.addedPermission`,
          );
          expectPositiveInteger(log.time, `${endpoint}.time`);
          return log as unknown as RouteResponse["judgement"]["data"]["logs"][number];
        });
        return { logs };
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
