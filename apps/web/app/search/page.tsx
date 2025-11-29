"use client";

import * as React from "react";
import {
  Calendar as CalendarIcon,
  Clock4,
  Filter as FilterIcon,
  Search as SearchIcon,
} from "lucide-react";
import { useSearchParams } from "next/navigation";

import {
  CATEGORY_OPTIONS,
  createMockResults,
  isSearchCategory,
  type SearchCategoryValue,
  type SearchResult,
} from "@/lib/search-data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchResultCard } from "@/components/search/search-result-card";

type DateRange = {
  from: string;
  to: string;
};

export default function SearchPage() {
  const searchParams = useSearchParams();

  const initialCategoryValues = React.useMemo(() => {
    const params = searchParams?.getAll("category") ?? [];
    const uniqueValid = Array.from(
      new Set(params.filter((value) => isSearchCategory(value))),
    );
    if (uniqueValid.length > 0) {
      return uniqueValid as SearchCategoryValue[];
    }
    return CATEGORY_OPTIONS.map((option) => option.value);
  }, [searchParams]);

  const initialCategoryKey = React.useMemo(() => {
    return [...initialCategoryValues].sort().join("|");
  }, [initialCategoryValues]);

  const [query, setQuery] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [isSuggestionOpen, setIsSuggestionOpen] = React.useState(false);
  const [selectedCategories, setSelectedCategories] = React.useState<
    Set<SearchCategoryValue>
  >(() => new Set(initialCategoryValues));
  const [dateRange, setDateRange] = React.useState<DateRange>({
    from: "",
    to: "",
  });
  const [results, setResults] = React.useState<SearchResult[]>(() =>
    createMockResults(14),
  );

  const debouncedSuggestionsRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    setSelectedCategories(new Set(initialCategoryValues));
  }, [initialCategoryKey, initialCategoryValues]);

  const hasActiveDateFilter = dateRange.from !== "" || dateRange.to !== "";
  const activeCategoryCount = selectedCategories.size;
  const appliedFilterSummary = `${activeCategoryCount}/${CATEGORY_OPTIONS.length} 分类${
    hasActiveDateFilter ? " · 时间范围" : ""
  }`;

  React.useEffect(() => {
    if (debouncedSuggestionsRef.current !== null) {
      window.clearTimeout(debouncedSuggestionsRef.current);
      debouncedSuggestionsRef.current = null;
    }

    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    debouncedSuggestionsRef.current = window.setTimeout(() => {
      setSuggestions(["预测A", "预测B"]);
      debouncedSuggestionsRef.current = null;
    }, 220);

    return () => {
      if (debouncedSuggestionsRef.current !== null) {
        window.clearTimeout(debouncedSuggestionsRef.current);
        debouncedSuggestionsRef.current = null;
      }
    };
  }, [query]);

  const handleCategoryToggle = React.useCallback(
    (value: SearchCategoryValue) => {
      setSelectedCategories((prev) => {
        const next = new Set(prev);
        if (next.has(value)) {
          next.delete(value);
        } else {
          next.add(value);
        }
        return next;
      });
    },
    [],
  );

  const handleDateChange = React.useCallback(
    (key: keyof DateRange, value: string) => {
      setDateRange((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setResults(createMockResults(16));
      setIsSuggestionOpen(false);
    },
    [],
  );

  const handleSuggestionSelect = React.useCallback((value: string) => {
    setQuery(value);
    setIsSuggestionOpen(false);
    setResults(createMockResults(16));
  }, []);

  const filteredResults = React.useMemo(() => {
    return results.filter((result) => selectedCategories.has(result.category));
  }, [results, selectedCategories]);

  return (
    <div className="flex flex-1 flex-col gap-10 px-6 pt-8 pb-16">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">站内搜索</h1>
            <p className="text-sm text-muted-foreground">
              通过高级筛选快速定位文章、讨论、团队、用户等内容。
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FilterIcon className="size-3.5" />
            当前筛选：{appliedFilterSummary}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="space-y-8">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => setIsSuggestionOpen(true)}
                placeholder="搜索文章、讨论、团队或用户..."
                className="h-12 rounded-2xl border-none bg-muted/40 pr-4 pl-12 text-base shadow-none focus-visible:ring-4"
              />
              {isSuggestionOpen && suggestions.length > 0 && (
                <div className="absolute top-[calc(100%+0.5rem)] right-0 left-0 z-20 overflow-hidden rounded-2xl border border-border bg-popover shadow-lg">
                  <ul className="divide-y divide-border">
                    {suggestions.map((item) => (
                      <li key={item}>
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleSuggestionSelect(item)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-muted"
                        >
                          <SearchIcon className="size-4 text-muted-foreground" />
                          <span>{item}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <section className="lg:col-span-2">
                <header className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">
                    检索范围
                  </h2>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() =>
                      setSelectedCategories(
                        new Set(CATEGORY_OPTIONS.map((option) => option.value)),
                      )
                    }
                  >
                    全部选择
                  </Button>
                </header>
                <div className="mt-4 flex flex-wrap gap-2">
                  {CATEGORY_OPTIONS.map((option) => {
                    const isActive = selectedCategories.has(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleCategoryToggle(option.value)}
                        className={cn(
                          "inline-flex items-center rounded-full border border-border px-3 py-1.5 text-sm text-foreground/80 transition hover:text-foreground",
                          isActive
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "bg-muted/40",
                        )}
                        aria-pressed={isActive}
                      >
                        <span className="mr-2 inline-flex size-2.5 rounded-full bg-current opacity-60" />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3 rounded-2xl bg-muted/30 p-4">
                <h2 className="text-sm font-semibold text-foreground">
                  日期 / 时间范围
                </h2>
                <div className="space-y-4 text-sm text-muted-foreground">
                  <label className="flex flex-col gap-1">
                    <span className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground/70 uppercase">
                      <CalendarIcon className="size-3.5" />
                      起始时间
                    </span>
                    <Input
                      type="datetime-local"
                      value={dateRange.from}
                      onChange={(event) =>
                        handleDateChange("from", event.target.value)
                      }
                      className="h-10 rounded-xl border border-border/70 bg-background"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground/70 uppercase">
                      <Clock4 className="size-3.5" />
                      截止时间
                    </span>
                    <Input
                      type="datetime-local"
                      value={dateRange.to}
                      onChange={(event) =>
                        handleDateChange("to", event.target.value)
                      }
                      className="h-10 rounded-xl border border-border/70 bg-background"
                    />
                  </label>
                </div>
              </section>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                输入关键字并按回车，或直接调整筛选项刷新结果。
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSelectedCategories(
                      new Set(CATEGORY_OPTIONS.map((option) => option.value)),
                    );
                    setDateRange({ from: "", to: "" });
                  }}
                >
                  重置筛选
                </Button>
                <Button type="submit" variant="default">
                  开始搜索
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>

      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">搜索结果</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              为你找到 {filteredResults.length} 条匹配结果。
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setResults(createMockResults(12))}
          >
            刷新结果
          </Button>
        </header>

        {filteredResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-border bg-muted/40 py-16 text-center">
            <p className="text-lg font-medium text-foreground/80">
              暂无匹配内容
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              可尝试放宽时间范围或调整检索范围。
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredResults.map((result) => (
              <SearchResultCard key={result.id} result={result} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
