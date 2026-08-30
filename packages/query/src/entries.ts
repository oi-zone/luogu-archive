import { getArticleEntries } from "./article.js";
import { getPostEntries } from "./discussion.js";
import type {
  ArticleEntryPreviewDto,
  PasteEntryPreviewDto,
  PostEntryPreviewDto,
  ProblemDto,
  PublicUserPreviewDto,
} from "./dto.js";
import { MAX_ENTRY_REFS } from "./entry-validation.js";
import { getPasteEntries } from "./paste.js";
import { getProblemEntries } from "./problem.js";
import { getUserEntries } from "./user.js";

interface EntryMap {
  user: PublicUserPreviewDto;
  discuss: PostEntryPreviewDto;
  article: ArticleEntryPreviewDto;
  problem: ProblemDto;
  paste: PasteEntryPreviewDto;
}

export type EntryType = keyof EntryMap;

export type EntryRef<K extends keyof EntryMap = keyof EntryMap> =
  K extends unknown ? { type: K; id: string } : never;

export type Entry<K extends keyof EntryMap = keyof EntryMap> = K extends unknown
  ? EntryRef<K> & { data: EntryMap[K] | null }
  : never;

export async function resolveEntries<K extends keyof EntryMap>(
  refs: EntryRef<K>[],
): Promise<Entry<K>[]> {
  if (refs.length > MAX_ENTRY_REFS) {
    throw new Error("Entry batch exceeds the configured query limit");
  }

  const uniqueIds = <T>(values: T[]) => Array.from(new Set(values));
  const userIds = uniqueIds(
    refs.filter(({ type }) => type === "user").map(({ id }) => Number(id)),
  );
  const postIds = uniqueIds(
    refs.filter(({ type }) => type === "discuss").map(({ id }) => Number(id)),
  );
  const articleIds = uniqueIds(
    refs.filter(({ type }) => type === "article").map(({ id }) => id),
  );
  const problemIds = uniqueIds(
    refs.filter(({ type }) => type === "problem").map(({ id }) => id),
  );
  const pasteIds = uniqueIds(
    refs.filter(({ type }) => type === "paste").map(({ id }) => id),
  );

  const [users, posts, articles, problems, pastes] = await Promise.all([
    userIds.length ? getUserEntries(userIds) : [],
    postIds.length ? getPostEntries(postIds) : [],
    articleIds.length ? getArticleEntries(articleIds) : [],
    problemIds.length ? getProblemEntries(problemIds) : [],
    pasteIds.length ? getPasteEntries(pasteIds) : [],
  ]);

  const mapping: {
    [K in keyof EntryMap]: Record<EntryRef<K>["id"], EntryMap[K]>;
  } = {
    user: Object.fromEntries(
      users.map((user) => [user.uid.toString(), user] as const),
    ),
    discuss: Object.fromEntries(
      posts.map((post) => [post.id.toString(), post] as const),
    ),
    article: Object.fromEntries(
      articles.map((article) => [article.lid, article] as const),
    ),
    problem: Object.fromEntries(
      problems.map((problem) => [problem.pid, problem] as const),
    ),
    paste: Object.fromEntries(
      pastes.map((paste) => [paste.id, paste] as const),
    ),
  };

  return refs.map(
    (ref) =>
      ({
        ...ref,
        data: mapping[ref.type][ref.id] ?? null,
      }) as Entry<K>,
  );
}
