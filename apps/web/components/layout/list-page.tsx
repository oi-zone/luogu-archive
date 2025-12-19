"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronsUpDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

type SortOrder = "newest" | "hottest" | "replies";

const SORT_LABELS: Record<SortOrder, string> = {
  newest: "Newest",
  hottest: "Hottest",
  replies: "Replies",
};

interface ListPageProps {
  title: string;
  searchType: "article" | "discussion";
  children: React.ReactNode;
  totalPages: number;
}

export function ListPage({
  title,
  searchType,
  children,
  totalPages,
}: ListPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPage = useMemo(
    () => parseInt(searchParams.get("page") ?? "1", 10),
    [searchParams],
  );
  const currentSort = useMemo(
    () => (searchParams.get("sort") as SortOrder) ?? "newest",
    [searchParams],
  );

  const createQueryString = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set(name, value);
    return params.toString();
  };

  const handleSortChange = (sort: SortOrder) => {
    router.push(`${pathname}?${createQueryString("sort", sort)}`);
  };

  const handlePageChange = (page: number) => {
    router.push(`${pathname}?${createQueryString("page", page.toString())}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="flex items-center space-x-2">
          <Link href={`/search?type=${searchType}`} className="w-64">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="cursor-pointer pl-9"
                readOnly
              />
            </div>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center space-x-2">
                <span>Sort by: {SORT_LABELS[currentSort]}</span>
                <ChevronsUpDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {(Object.keys(SORT_LABELS) as SortOrder[]).map((sort) => (
                <DropdownMenuItem
                  key={sort}
                  onClick={() => handleSortChange(sort)}
                >
                  {SORT_LABELS[sort]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {children}
      <div className="flex items-center justify-center space-x-2">
        <Button
          variant="outline"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          Previous
        </Button>
        <span className="text-sm">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
