import type { ProblemSummary } from "@lgjs/types";

import { prisma } from "@luogu-discussion-archive/db";

export const saveProblem = async (
  problem: ProblemSummary,
  now: Date | string,
) =>
  prisma.problem.upsert({
    where: { pid: problem.pid },
    update: {
      title: problem.title,
      difficulty: problem.difficulty,
      updatedAt: now,
    },
    create: {
      pid: problem.pid,
      title: problem.title,
      difficulty: problem.difficulty,
      updatedAt: now,
    },
  });
