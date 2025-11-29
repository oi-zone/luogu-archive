"use client";

import * as React from "react";
import { ListChecks, Search } from "lucide-react";
import Link from "next/link";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";

export function AppTopbar({
  crumbs,
  action,
}: {
  crumbs?: Array<{ label: string; href?: string }>;
  action?: React.ReactNode;
}) {
  const navigationCrumbs = crumbs?.length ? crumbs : defaultCrumbs;

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Breadcrumb>
            <BreadcrumbList>
              {navigationCrumbs.map((crumb, index) => (
                <React.Fragment key={`${crumb.label}-${index}`}>
                  <BreadcrumbItem className="text-sm font-medium">
                    {crumb.href ? (
                      <BreadcrumbLink href={crumb.href}>
                        {crumb.label}
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                  {index !== navigationCrumbs.length - 1 && (
                    <BreadcrumbSeparator />
                  )}
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="flex items-center gap-3">
          {action}
          <Link href="/queue" scroll={false}>
            <Button variant="outline" size="sm" className="gap-2 rounded-xl">
              <ListChecks className="size-4" />
              <span className="hidden sm:inline">队列</span>
            </Button>
          </Link>
          <Link href="/search" scroll={false}>
            <Button variant="outline" size="sm" className="gap-2 rounded-xl">
              <Search className="size-4" />
              <span className="hidden sm:inline">搜索</span>
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

const defaultCrumbs = [{ label: "首页", href: "/" }, { label: "社区精选" }];
