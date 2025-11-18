"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, UserPlus } from "lucide-react";
import Image from "next/image";

import { NAME_COLOR_CLASS, type RelatedUser } from "@/lib/user-profile-shared";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type UserRecommendationsProps = {
  users: RelatedUser[];
  layout?: "sidebar" | "stacked" | "carousel";
};

export function UserRecommendations({
  users,
  layout = "sidebar",
}: UserRecommendationsProps) {
  if (layout === "carousel") {
    return <MobileRecommendationsPager users={users} />;
  }

  if (users.length === 0) {
    return null;
  }

  return (
    <section className="border-border text-card-foreground rounded-3xl border p-5 shadow-sm">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">相关用户</h3>
          <p className="text-muted-foreground text-xs">可能感兴趣的同好</p>
        </div>
      </header>
      <div className="space-y-4">
        {users.map((user) => (
          <UserRecommendationCard
            key={user.id}
            user={user}
            className={layout === "stacked" ? "shadow-sm" : undefined}
          />
        ))}
      </div>
    </section>
  );
}

function MobileRecommendationsPager({ users }: { users: RelatedUser[] }) {
  const [pageIndex, setPageIndex] = React.useState(0);

  React.useEffect(() => {
    setPageIndex(0);
  }, [users.length]);

  if (users.length === 0) {
    return null;
  }

  const totalPages = Math.max(1, users.length);
  const clampedIndex = Math.min(pageIndex, totalPages - 1);
  const currentUser = users[clampedIndex];
  const showNav = totalPages > 1;

  const goToPage = (next: number) => {
    const bounded = Math.min(Math.max(next, 0), totalPages - 1);
    setPageIndex(bounded);
  };

  return (
    <section className="border-border bg-background/95 rounded-3xl border p-4 shadow-sm sm:p-5">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">相关用户</h3>
          <p className="text-muted-foreground text-xs">向右切换查看更多</p>
        </div>
        {showNav && (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => goToPage(clampedIndex - 1)}
              disabled={clampedIndex === 0}
              aria-label="上一位推荐用户"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <span className="text-muted-foreground text-xs font-medium">
              {clampedIndex + 1} / {totalPages}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => goToPage(clampedIndex + 1)}
              disabled={clampedIndex === totalPages - 1}
              aria-label="下一位推荐用户"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        )}
      </header>
      <UserRecommendationCard user={currentUser} />
    </section>
  );
}

function UserRecommendationCard({
  user,
  className,
}: {
  user: RelatedUser;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "border-border/60 bg-muted/40 flex flex-col items-start gap-4 rounded-2xl border p-4 shadow-none sm:flex-row",
        className,
      )}
    >
      <div className="border-border/60 bg-background relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border">
        <Image
          src={user.avatarUrl}
          alt={user.name}
          fill
          sizes="56px"
          className="object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <p
              className={cn(
                "text-sm font-semibold leading-tight",
                NAME_COLOR_CLASS[user.nameColor],
              )}
            >
              {user.name}
            </p>
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span>@{user.username}</span>
              {user.ccfLevel ? (
                <span className="border-border/60 rounded-full border px-2.5 py-0.5 text-[11px] font-medium">
                  CCF Lv.{user.ccfLevel}
                </span>
              ) : null}
            </div>
            {user.tag ? (
              <span className="border-border/60 text-muted-foreground mt-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium">
                {user.tag}
              </span>
            ) : null}
          </div>
          <span className="bg-primary/10 text-primary inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-medium">
            共同标签 {user.mutualTags}
          </span>
        </div>
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
          {user.headline}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="h-7 rounded-full px-3 text-xs"
          >
            <UserPlus className="mr-1 size-3.5" aria-hidden />
            关注
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 rounded-full px-3 text-xs"
          >
            查看主页
          </Button>
        </div>
      </div>
    </article>
  );
}
