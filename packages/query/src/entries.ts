import { getArticleEntries } from "./article.js";
import { getPostEntries } from "./discussion.js";
import type {
  ArticleDto,
  PasteDto,
  PostDto,
  ProblemDto,
  UserDto,
} from "./dto.js";
import { getPasteEntries } from "./paste.js";
import { getProblemEntries } from "./problem.js";
import { getUserEntries } from "./user.js";

interface EntryMap {
  user: UserDto;
  discuss: PostDto;
  article: ArticleDto;
  problem: ProblemDto;
  paste: PasteDto;
}

export type EntryRef<K extends keyof EntryMap = keyof EntryMap> =
  K extends unknown ? { type: K; id: string } : never;

export type Entry<K extends keyof EntryMap = keyof EntryMap> = K extends unknown
  ? EntryRef<K> & { data: EntryMap[K] | null }
  : never;

export async function resolveEntries<K extends keyof EntryMap>(
  refs: EntryRef<K>[],
): Promise<Entry<K>[]> {
  const users = await getUserEntries(
    refs.filter(({ type }) => type === "user").map(({ id }) => Number(id)),
  );
  const posts = await getPostEntries(
    refs.filter(({ type }) => type === "discuss").map(({ id }) => Number(id)),
  );
  const articles = await getArticleEntries(
    refs.filter(({ type }) => type === "article").map(({ id }) => id),
  );
  const problems = await getProblemEntries(
    refs.filter(({ type }) => type === "problem").map(({ id }) => id),
  );
  const pastes = await getPasteEntries(
    refs.filter(({ type }) => type === "paste").map(({ id }) => id),
  );

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
