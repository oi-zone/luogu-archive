import {
  generateFeedItem,
  generateFeedItems,
  type ArticleFeedItem,
  type DiscussionFeedItem,
  type FeedItem,
} from "@/lib/feed-data";

export const CATEGORY_OPTIONS = [
  {
    value: "article",
    label: "文章",
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  },
  {
    value: "discussion",
    label: "讨论",
    badgeClass: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  },
  {
    value: "article-comment",
    label: "文章的评论",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  },
  {
    value: "discussion-reply",
    label: "讨论的回复",
    badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300",
  },
  {
    value: "paste",
    label: "剪贴板",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  },
  {
    value: "team",
    label: "团队",
    badgeClass: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-300",
  },
  {
    value: "user",
    label: "用户",
    badgeClass: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  },
  {
    value: "ostraka",
    label: "陶片放逐",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  },
] as const;

export type CategoryOption = (typeof CATEGORY_OPTIONS)[number];
export type SearchCategoryValue = CategoryOption["value"];

const CATEGORY_OPTION_MAP = new Map<SearchCategoryValue, CategoryOption>(
  CATEGORY_OPTIONS.map((option) => [option.value, option]),
);

export function getCategoryMeta(value: SearchCategoryValue) {
  return CATEGORY_OPTION_MAP.get(value) ?? null;
}

export function isSearchCategory(value: string): value is SearchCategoryValue {
  return CATEGORY_OPTION_MAP.has(value as SearchCategoryValue);
}

export type SearchResult = FeedItem & {
  category: SearchCategoryValue;
};

export type ArticleSearchResult = SearchResult & ArticleFeedItem;
export type DiscussionSearchResult = SearchResult & DiscussionFeedItem;

export function createMockResults(count: number): SearchResult[] {
  const baseItems = generateFeedItems(count);
  return baseItems.map((item) => ({
    ...item,
    category: pickRandom(CATEGORY_OPTIONS).value,
  }));
}

export function createCategoryResults(
  category: "article",
  count: number,
): ArticleSearchResult[];
export function createCategoryResults(
  category: "discussion",
  count: number,
): DiscussionSearchResult[];
export function createCategoryResults(
  category: SearchCategoryValue,
  count: number,
): SearchResult[];
export function createCategoryResults(
  category: SearchCategoryValue,
  count: number,
): SearchResult[] {
  const results: SearchResult[] = [];
  const requiresMatchingType =
    category === "article" || category === "discussion";

  while (results.length < count) {
    const base = generateFeedItem();
    if (requiresMatchingType && base.type !== category) {
      continue;
    }
    results.push({
      ...base,
      category,
    });
  }

  return results;
}

function pickRandom<T>(collection: readonly T[]): T {
  const index = Math.floor(Math.random() * collection.length);
  return collection[index];
}
