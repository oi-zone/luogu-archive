import type { ProblemSummary } from "@lgjs/types";

import { prisma } from "@luogu-discussion-archive/db";

export const saveProblem = async (problem: ProblemSummary) =>
  prisma.problem.upsert({
    where: { pid: problem.pid },
    update: {
      title: problem.title,
      difficulty: problem.difficulty,
    },
    create: {
      pid: problem.pid,
      title: problem.title,
      difficulty: problem.difficulty,
    },
  });
