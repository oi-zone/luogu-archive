import { prisma } from "@luogu-discussion-archive/db";

export async function getUserWithLatestSnapshot(id: number) {
  return await prisma.user.findFirst({
    where: { id },
    include: {
      snapshots: {
        orderBy: { capturedAt: "desc" },
        take: 1,
      },
    },
    take: 1,
  });
}
