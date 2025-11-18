"use client";

import * as React from "react";
import { ChevronsUpDown, Filter, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { createCategoryResults, type SearchResult } from "@/lib/search-data";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchResultCard } from "@/components/search/search-result-card";

type SortOption = "latest" | "popular" | "replies";

const SORT_OPTIONS: Record<
  SortOption,
  { label: string; comparator: (a: SearchResult, b: SearchResult) => number }
> = {
  latest: {
    label: "最新回复",
    comparator: (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
  },
  popular: {
    label: "按热度",
    comparator: (a, b) =>
      (b.type === "discussion" ? b.views : 0) -
      (a.type === "discussion" ? a.views : 0),
  },
  replies: {
    label: "按回复",
    comparator: (a, b) =>
      (b.type === "discussion" ? b.replies : 0) -
      (a.type === "discussion" ? a.replies : 0),
  },
};

const PAGE_SIZE = 20;
const TOTAL_ITEMS = PAGE_SIZE * 3;

export default function DiscussionsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const baseResults = React.useMemo(() => {
    return createCategoryResults("discussion", TOTAL_ITEMS);
  }, []);

  const currentSort = (searchParams.get("sort") as SortOption) ?? "latest";
  const rawPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const currentPage = Number.isNaN(rawPage) ? 1 : rawPage;

  const sortedResults = React.useMemo(() => {
    const { comparator } = SORT_OPTIONS[currentSort] ?? SORT_OPTIONS.latest;
    return [...baseResults].sort(comparator);
  }, [baseResults, currentSort]);

  const totalPages = Math.max(1, Math.ceil(sortedResults.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);

  const paginatedResults = React.useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return sortedResults.slice(start, start + PAGE_SIZE);
  }, [sortedResults, safePage]);

  const createQueryString = React.useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams ?? undefined);
      Object.entries(updates).forEach(([key, value]) => {
        params.set(key, value);
      });
      return params.toString();
    },
    [searchParams],
  );

  const handleSortChange = React.useCallback(
    (nextSort: SortOption) => {
      router.replace(
        `${pathname}?${createQueryString({ sort: nextSort, page: "1" })}`,
        { scroll: false },
      );
    },
    [createQueryString, pathname, router],
  );

  const handlePageChange = React.useCallback(
    (nextPage: number) => {
      const clamped = Math.min(Math.max(nextPage, 1), totalPages);
      router.replace(
        `${pathname}?${createQueryString({ page: String(clamped) })}`,
        { scroll: false },
      );
    },
    [createQueryString, pathname, router, totalPages],
  );

  return (
    <div className="flex flex-1 flex-col gap-8 px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm font-medium">讨论区</p>
            <h1 className="text-3xl font-semibold tracking-tight">热门讨论</h1>
            <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
              汇总近期讨论话题与高质量解答，帮助你快速找到关注的内容。可以按照回复、热度或投票排序查看。
            </p>
          </div>
          <Link
            href="/search?category=discussion"
            scroll={false}
            prefetch={false}
            className="bg-muted/40 text-foreground/80 hover:text-foreground border-border focus-visible:ring-primary/20 focus-visible:ring-offset-background relative flex h-12 w-full items-center rounded-2xl border px-4 text-sm transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 sm:w-72"
          >
            <Search className="text-muted-foreground absolute left-4 top-1/2 size-4 -translate-y-1/2" />
            <span className="pl-8">搜索讨论、作者或标签…</span>
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-muted-foreground text-sm">
            第 {safePage} 页，共 {totalPages} 页 · 当前排序：
            {SORT_OPTIONS[currentSort]?.label ?? SORT_OPTIONS.latest.label}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/search?category=discussion"
              scroll={false}
              prefetch={false}
              className="text-muted-foreground hover:text-foreground hidden transition sm:inline-flex"
            >
              <Filter className="size-4" />
              <span className="ml-2 text-sm">高级筛选</span>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="flex items-center gap-2 rounded-xl px-3 py-2"
                >
                  <span>
                    排序方式 ·{" "}
                    {SORT_OPTIONS[currentSort]?.label ??
                      SORT_OPTIONS.latest.label}
                  </span>
                  <ChevronsUpDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {(Object.keys(SORT_OPTIONS) as SortOption[]).map((option) => (
                  <DropdownMenuItem
                    key={option}
                    onClick={() => handleSortChange(option)}
                  >
                    {SORT_OPTIONS[option].label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <section className="space-y-4">
        {paginatedResults.map((discussion) => (
          <SearchResultCard key={discussion.id} result={discussion} />
        ))}
      </section>

      <footer className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        <div className="text-muted-foreground text-sm">
          共 {sortedResults.length} 条讨论 · 每页 {PAGE_SIZE} 条
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => handlePageChange(safePage - 1)}
            disabled={safePage <= 1}
          >
            上一页
          </Button>
          <div className="text-muted-foreground text-sm font-medium">
            {safePage} / {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => handlePageChange(safePage + 1)}
            disabled={safePage >= totalPages}
          >
            下一页
          </Button>
        </div>
      </footer>
    </div>
  );
}
