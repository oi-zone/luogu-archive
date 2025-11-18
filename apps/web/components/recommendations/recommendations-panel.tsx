"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { SearchResult } from "@/lib/search-data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SearchResultCard } from "@/components/search/search-result-card";

type RecommendationsPanelProps = {
  items: SearchResult[];
  layout?: "stacked" | "inline";
  className?: string;
};

export function RecommendationsPanel({
  items,
  layout = "stacked",
  className,
}: RecommendationsPanelProps) {
  if (layout === "inline") {
    return <InlineRecommendations items={items} className={className} />;
  }

  return (
    <div className={className}>
      <h2 className="text-foreground text-xl font-semibold">相关推荐</h2>
      <div className="space-y-4">
        {items.map((item) => (
          <SearchResultCard key={item.id} result={item} />
        ))}
      </div>
    </div>
  );
}

type InlineRecommendationsProps = {
  items: SearchResult[];
  className?: string;
};

function InlineRecommendations({
  items,
  className,
}: InlineRecommendationsProps) {
  const LG_BREAKPOINT = 1024;
  const [itemsPerPage, setItemsPerPage] = React.useState(1);
  const [pageIndex, setPageIndex] = React.useState(0);

  React.useEffect(() => {
    setPageIndex(0);
  }, [items]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleResize = () => {
      setItemsPerPage(window.innerWidth >= LG_BREAKPOINT ? 2 : 1);
    };

    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  React.useEffect(() => {
    setPageIndex(0);
  }, [itemsPerPage]);

  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));

  React.useEffect(() => {
    if (pageIndex > totalPages - 1) {
      setPageIndex(totalPages - 1);
    }
  }, [pageIndex, totalPages]);

  const start = pageIndex * itemsPerPage;
  const visibleItems = items.slice(start, start + itemsPerPage);

  const isSingleVisible = visibleItems.length === 1;
  const shouldFullSpan = isSingleVisible && itemsPerPage > 1;

  const showNav = totalPages > 1;

  return (
    <div className={className}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-foreground text-base font-semibold">相关推荐</h2>
        {showNav && (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setPageIndex((prev) => Math.max(prev - 1, 0))}
              disabled={pageIndex === 0}
              aria-label="上一页推荐"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <span className="text-muted-foreground text-xs font-medium">
              {pageIndex + 1} / {totalPages}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() =>
                setPageIndex((prev) => Math.min(prev + 1, totalPages - 1))
              }
              disabled={pageIndex === totalPages - 1}
              aria-label="下一页推荐"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {visibleItems.map((item) => (
          <div
            key={item.id}
            className={cn("min-w-0", shouldFullSpan && "col-span-2")}
          >
            <SearchResultCard result={item} />
          </div>
        ))}
      </div>
    </div>
  );
}
