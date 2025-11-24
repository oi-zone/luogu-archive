import type { ProblemSummary } from "@lgjs/types";

import { db, schema, sql } from "@luogu-discussion-archive/db/drizzle";

import { deduplicate } from "./utils.js";

export async function saveProblems(problems: ProblemSummary[], now: Date) {
  const deduplicatedProblems = deduplicate(problems, (problem) => problem.pid);
  if (!deduplicatedProblems.length) return;

  return db
    .insert(schema.Problem)
    .values(
      deduplicatedProblems.map((problem) => ({
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
}
