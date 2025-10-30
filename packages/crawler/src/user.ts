import type { UserSummary } from "@lgjs/types";

import { prisma } from "@luogu-discussion-archive/db";

import { PgAdvisoryLock } from "./locks.js";

export const saveUser = (user: UserSummary, now: Date | string) =>
  prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PgAdvisoryLock.User}::INT4, ${user.uid}::INT4);`;

    const lastSnapshot = await tx.userSnapshot.findFirst({
      where: {
        userId: user.uid,
      },
      orderBy: {
        capturedAt: "desc",
      },
    });
    if (
      lastSnapshot &&
      lastSnapshot.name === user.name &&
      lastSnapshot.slogan === (user.slogan ?? "") &&
      lastSnapshot.badge === user.badge &&
      lastSnapshot.isAdmin === user.isAdmin &&
      lastSnapshot.isBanned === user.isBanned &&
      lastSnapshot.isRoot === (user.isRoot ?? false) &&
      lastSnapshot.color === user.color &&
      lastSnapshot.ccfLevel === user.ccfLevel &&
      lastSnapshot.xcpcLevel === user.xcpcLevel &&
      lastSnapshot.background === (user.background ?? "")
    )
      return tx.userSnapshot.update({
        where: {
          userId_capturedAt: {
            userId: user.uid,
            capturedAt: lastSnapshot.capturedAt,
          },
        },
        data: { lastSeenAt: now },
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
      },
    });
  });
