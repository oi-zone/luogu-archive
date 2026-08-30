import { refreshQueue } from "@luogu-discussion-archive/queue";

const discuss: { name: string; page: number; pattern: string }[] = [
  { name: "1-daytime", page: 1, pattern: "* 7-23,0 * * *" },
  { name: "1-night", page: 1, pattern: "*/10 1-6 * * *" },
  { name: "2", page: 2, pattern: "*/2 8-23 * * *" },
  { name: "3", page: 3, pattern: "*/3 8-23 * * *" },
  { name: "4", page: 4, pattern: "*/4 8-23 * * *" },
  { name: "20", page: 20, pattern: "*/5 8-23 * * *" },
];

const articles: { page: number; pattern: string }[] = Array.from(
  { length: 30 },
  (_, i) => ({
    page: i + 1,
    pattern: `${String(i + 1)} 1 * * *`,
  }),
);

export async function configureSchedulers() {
  await Promise.all(
    discuss.map(({ name, page, pattern }) =>
      refreshQueue.upsertJobScheduler(
        `list-discuss-${name}`,
        { pattern },
        { name: "listDiscuss", data: { type: "listDiscuss", page } },
      ),
    ),
  );

  await Promise.all(
    articles.map(({ page, pattern }) =>
      refreshQueue.upsertJobScheduler(
        `list-articles-page-${String(page)}`,
        { pattern },
        { name: "listArticles", data: { type: "listArticles", page } },
      ),
    ),
  );

  await refreshQueue.upsertJobScheduler(
    "fetch-judgement",
    { pattern: "* * * * *" },
    { name: "judgement", data: { type: "judgement" } },
  );

  for (const entityType of ["article", "discussion", "paste"] as const) {
    await refreshQueue.upsertJobScheduler(
      `visibility-scan-${entityType}`,
      { pattern: "*/10 * * * *" },
      {
        name: "visibilityScan",
        data: { type: "visibilityScan", entityType },
      },
    );
  }
}
