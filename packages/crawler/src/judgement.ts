import type { RouteResponse } from "@lgjs/types";

import { prisma } from "@luogu-discussion-archive/db";

import { cn } from "./client.js";
import { HttpError } from "./error.js";
import { saveUserSnapshots } from "./user.js";

async function saveLog(
  log: RouteResponse["judgement"]["data"]["logs"][number],
  now: Date,
) {
  await saveUserSnapshots([log.user], now);

  return prisma.judgement.upsert({
    where: {
      time_userId: { time: new Date(log.time * 1000), userId: log.user.uid },
    },
    create: {
      userId: log.user.uid,
      reason: log.reason,
      revokedPermission: log.revokedPermission,
      addedPermission: log.addedPermission,
      time: new Date(log.time * 1000),
    },
    update: {
      reason: log.reason,
      revokedPermission: log.revokedPermission,
      addedPermission: log.addedPermission,
    },
  });
}

export async function fetchJudgement() {
  const res = await cn.get("judgement");
  const { status, data, time } = await res.json().catch((err: unknown) => {
    throw res.ok ? err : new HttpError(res.url, res.status);
  });
  if (status !== 200) throw new HttpError(res.url, status);

  const now = new Date(time * 1000);
  return Promise.all(data.logs.map((log) => saveLog(log, now)));
}
