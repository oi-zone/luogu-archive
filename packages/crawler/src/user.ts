import type { UserSummary } from "@lgjs/types";

import { prisma } from "@luogu-discussion-archive/db";

export const saveUser = (user: UserSummary, now: Date | string) =>
  prisma.$transaction(async (tx) => {
    const lastSnapshot = await tx.userSnapshot.findFirst({
      where: {
        userId: user.uid,
      },
      orderBy: {
        time: "desc",
      },
    });
    if (
      lastSnapshot &&
      lastSnapshot.name === user.name &&
      lastSnapshot.badge === user.badge &&
      lastSnapshot.isAdmin === user.isAdmin &&
      lastSnapshot.isBanned === user.isBanned &&
      lastSnapshot.isRoot === (user.isRoot ?? null) &&
      lastSnapshot.color === user.color &&
      lastSnapshot.ccfLevel === user.ccfLevel
    )
      return tx.userSnapshot.update({
        where: { userId_time: { userId: user.uid, time: lastSnapshot.time } },
        data: { until: now },
      });
    return tx.userSnapshot.create({
      data: {
        user: {
          connectOrCreate: {
            where: { id: user.uid },
            create: { id: user.uid },
          },
        },
        name: user.name,
        badge: user.badge,
        isAdmin: user.isAdmin,
        isBanned: user.isBanned,
        isRoot: user.isRoot ?? null,
        color: user.color,
        ccfLevel: user.ccfLevel,
        time: now,
        until: now,
      },
    });
  });
