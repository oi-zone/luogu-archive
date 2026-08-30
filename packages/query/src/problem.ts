import { db, inArray, schema, sql } from "@luogu-discussion-archive/db";

import type { ProblemDto } from "./dto.js";

export const getProblemEntries = (pids: string[]): Promise<ProblemDto[]> =>
  pids.length === 0
    ? Promise.resolve([])
    : db
        .select({
          pid: schema.Problem.pid,
          title: sql<string>`left(${schema.Problem.title}, 512)`,
          difficulty: schema.Problem.difficulty,
        })
        .from(schema.Problem)
        .where(inArray(schema.Problem.pid, pids));
