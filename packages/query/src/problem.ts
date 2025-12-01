import {
  countDistinct,
  db,
  eq,
  schema,
} from "@luogu-discussion-archive/db/drizzle";

export interface ProblemBasicInfo {
  pid: string;
  title: string;
  difficulty: number | null;
  updatedAt: Date;
  solutionsCount: number;
}

export async function getProblemBasicInfo(
  pid: string,
): Promise<ProblemBasicInfo | null> {
  const normalizedPid = pid.trim();
  if (!normalizedPid) {
    return null;
  }

  const problem = await db.query.Problem.findFirst({
    where: eq(schema.Problem.pid, normalizedPid),
    columns: {
      pid: true,
      title: true,
      difficulty: true,
      updatedAt: true,
    },
  });

  if (!problem) {
    return null;
  }

  const countRows = await db
    .select({ count: countDistinct(schema.ArticleSnapshot.articleId) })
    .from(schema.ArticleSnapshot)
    .where(eq(schema.ArticleSnapshot.solutionForPid, normalizedPid));
  const solutionCount = countRows[0]?.count ?? 0;

  return {
    pid: problem.pid,
    title: problem.title,
    difficulty: problem.difficulty ?? null,
    updatedAt: problem.updatedAt,
    solutionsCount: solutionCount,
  } satisfies ProblemBasicInfo;
}
