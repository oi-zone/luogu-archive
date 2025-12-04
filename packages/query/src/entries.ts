import { getArticleEntries } from "./article.js";
import { getPostEntries } from "./discussion.js";
import type { ArticleDto, PostDto } from "./dto.js";

interface EntryMap {
  discuss: PostDto;
  article: ArticleDto;
}

export type EntryRef<K extends keyof EntryMap = keyof EntryMap> =
  K extends unknown ? { type: K; id: string } : never;

export type Entry<K extends keyof EntryMap = keyof EntryMap> = K extends unknown
  ? EntryRef<K> & { data: EntryMap[K] | null }
  : never;

export async function resolveEntries<K extends keyof EntryMap>(
  refs: EntryRef<K>[],
): Promise<Entry<K>[]> {
  const posts = await getPostEntries(
    refs.filter(({ type }) => type === "discuss").map(({ id }) => Number(id)),
  );
  const articles = await getArticleEntries(
    refs.filter(({ type }) => type === "article").map(({ id }) => id),
  );

  const mapping: {
    [K in keyof EntryMap]: Record<EntryRef<K>["id"], EntryMap[K]>;
  } = {
    discuss: Object.fromEntries(
      posts.map((post) => [post.id.toString(), post] as const),
    ),
    article: Object.fromEntries(
      articles.map((article) => [article.lid, article] as const),
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
