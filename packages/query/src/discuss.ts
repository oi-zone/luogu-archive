import { prisma } from "@luogu-discussion-archive/db";

export const getPostLatestSnapshot = (id: number) =>
  prisma.postSnapshot.findFirst({
    where: { postId: id },
    orderBy: { capturedAt: "desc" },
  });
