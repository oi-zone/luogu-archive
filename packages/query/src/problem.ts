import { db, inArray, schema } from "@luogu-discussion-archive/db";

import type { ProblemDto } from "./dto.js";

export const getProblemEntries = (pids: string[]): Promise<ProblemDto[]> =>
  db.query.Problem.findMany({ where: inArray(schema.Problem.pid, pids) });
