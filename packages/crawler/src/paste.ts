import type { Paste } from "@lgjs/types";

import { prisma } from "@luogu-discussion-archive/db";

import { client } from "./client.js";
import { AccessError } from "./error.js";
import { saveUserSnapshot } from "./user.js";

async function savePaste(paste: Paste, now: Date | string) {
  await saveUserSnapshot(paste.user, now);

  return prisma.paste.upsert({
    where: { id: paste.id },
    update: {
      time: new Date(paste.time * 1000),
      userId: paste.user.uid,
    },
    create: {
      id: paste.id,
      time: new Date(paste.time * 1000),
      userId: paste.user.uid,
    },
  });
}

async function savePasteSnapshot(paste: Paste, now: Date | string) {
  await savePaste(paste, now);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${parseInt(paste.id, 36)});`;

    const lastSnapshot = await tx.pasteSnapshot.findFirst({
      where: { pasteId: paste.id },
      orderBy: { capturedAt: "desc" },
    });

    if (
      lastSnapshot &&
      lastSnapshot.public === paste.public &&
      lastSnapshot.data === paste.data
    )
      return tx.pasteSnapshot.update({
        where: {
          pasteId_capturedAt: {
            pasteId: paste.id,
            capturedAt: lastSnapshot.capturedAt,
          },
        },
        data: { lastSeenAt: now },
      });

    return tx.pasteSnapshot.create({
      data: {
        pasteId: paste.id,
        public: paste.public,
        data: paste.data,
        capturedAt: now,
        lastSeenAt: now,
      },
    });
  });
}

export async function fetchPaste(id: string) {
  const { code, currentData, currentTime } = await (
    await client.get("paste.show", { params: { id } })
  ).json();
  if (code !== 200) throw new AccessError("Failed to fetch paste", code);
  const now = new Date(currentTime * 1000);

  return savePasteSnapshot(currentData.paste, now);
}
