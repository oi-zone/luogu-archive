import { db, inArray, schema } from "@luogu-discussion-archive/db";

import type { ProblemDto } from "./dto.js";

export const getProblemEntries = (pids: string[]): Promise<ProblemDto[]> =>
  pids.length === 0
    ? Promise.resolve([])
    : db.query.Problem.findMany({
        where: inArray(schema.Problem.pid, pids),
      });
