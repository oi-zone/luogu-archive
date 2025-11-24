import type { ProblemSummary } from "@lgjs/types";

import { db, schema, sql } from "@luogu-discussion-archive/db/drizzle";

export const saveProblems = async (problems: ProblemSummary[], now: Date) =>
  db
    .insert(schema.Problem)
    .values(
      problems.map((problem) => ({
        pid: problem.pid,
        title: problem.title,
        difficulty: problem.difficulty,
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: [schema.Problem.pid],
      set: {
        title: sql.raw(`excluded."${schema.Problem.title.name}"`),
        difficulty: sql.raw(`excluded."${schema.Problem.difficulty.name}"`),
        updatedAt: sql.raw(`excluded."${schema.Problem.updatedAt.name}"`),
      },
    });
