"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { formatRelativeTime } from "@/lib/feed-data";
import type { UsernameHistoryEntry } from "@/lib/user-profile-data";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function UsernameHistoryCard({
  entries,
}: {
  entries: UsernameHistoryEntry[];
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(true);

  React.useEffect(() => {
    setOpen(!isMobile);
  }, [isMobile]);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="border-border text-card-foreground rounded-3xl border shadow-sm"
    >
      <div className="flex items-center justify-between gap-2 px-6 py-4">
        <div>
          <h3 className="text-base font-semibold">历史用户名</h3>
          <p className="text-muted-foreground text-xs">追踪最近的改名记录</p>
        </div>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground inline-flex items-center gap-1 text-xs font-medium"
          >
            {open ? "收起" : "展开"}
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                open ? "rotate-180" : "rotate-0",
              )}
              aria-hidden
            />
          </button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent
        forceMount
        className="px-6 pb-5 data-[state=closed]:hidden"
      >
        <ol className="border-border/80 space-y-4 border-l border-dashed pl-5">
          {entries.map((entry, index) => {
            const current = index === 0;
            const changedAt = new Date(entry.changedAt);
            const relative = formatRelativeTime(changedAt);

            return (
              <li key={entry.id} className="relative pl-3">
                <span
                  aria-hidden
                  className={cn(
                    "border-card bg-background absolute -left-[17px] top-1 flex size-3 items-center justify-center rounded-full border-2",
                    current ? "bg-primary" : "bg-border/80",
                  )}
                />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-foreground text-sm font-medium">
                    {entry.username}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {DATE_FORMATTER.format(changedAt)}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {relative}
                  </span>
                </div>
                {entry.note ? (
                  <p className="text-muted-foreground/80 mt-1 text-xs">
                    {entry.note}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}
