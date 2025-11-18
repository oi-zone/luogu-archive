"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import type { UsernameHistoryEntry } from "@/lib/user-profile-shared";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ccfLevelToColor,
  UserInlineDisplay,
  xcpcLevelToColor,
} from "@/components/user/user-inline-link";

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
  const collapsedEntries = React.useMemo(
    () => collapseHistoryEntries(entries),
    [entries],
  );

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
        {collapsedEntries.length === 0 ? (
          <p className="text-muted-foreground text-sm">暂无改名记录</p>
        ) : (
          <ol className="border-border/80 space-y-5 border-l border-dashed pl-5">
            {collapsedEntries.map((entry, index) => {
              const current = index === 0;
              const latestChange = getEntryDate(entry.entries[0]);
              const earliest = entry.entries[entry.entries.length - 1];
              const earliestDate = getEntryDate(earliest) ?? latestChange;
              return (
                <li key={entry.id} className="relative pl-3">
                  <span
                    aria-hidden
                    className={cn(
                      "border-card bg-background absolute -left-[17px] top-1.5 flex size-3 items-center justify-center rounded-full border-2",
                      current ? "bg-primary" : "bg-border/80",
                    )}
                  />
                  <UserInlineDisplay
                    user={entry.snapshot}
                    compact
                    className="pr-1"
                  />
                  <div className="text-muted-foreground/80 mt-1 flex flex-wrap gap-3 text-[11px]">
                    <span title={latestChange?.toISOString()}>
                      最后捕获于 {formatDate(latestChange)}
                    </span>
                    <span title={earliestDate?.toISOString()}>
                      最早追溯到 {formatDate(earliestDate)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

type CollapsedHistoryEntry = {
  id: string;
  snapshot: UsernameHistoryEntry["snapshot"];
  entries: UsernameHistoryEntry[];
};

type CollapsedHistoryEntryInternal = CollapsedHistoryEntry & {
  appearanceKey: string;
};

function collapseHistoryEntries(
  entries: UsernameHistoryEntry[],
): CollapsedHistoryEntry[] {
  if (entries.length === 0) return [];

  const ordered = [...entries].sort(
    (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
  );
  const collapsed: CollapsedHistoryEntryInternal[] = [];

  for (const entry of ordered) {
    const appearanceKey = getAppearanceKey(entry.snapshot);
    const tail = collapsed[collapsed.length - 1];
    if (tail && tail.appearanceKey === appearanceKey) {
      tail.entries.push(entry);
      continue;
    }

    collapsed.push({
      id: entry.id,
      snapshot: entry.snapshot,
      entries: [entry],
      appearanceKey,
    });
  }

  return collapsed;
}

function getAppearanceKey(snapshot: UsernameHistoryEntry["snapshot"]) {
  const ccfVisual = snapshot.ccfLevel
    ? ccfLevelToColor(snapshot.ccfLevel)
    : "none";
  const xcpcVisual = snapshot.xcpcLevel
    ? xcpcLevelToColor(snapshot.xcpcLevel)
    : "none";
  return [
    snapshot.name,
    snapshot.color,
    snapshot.badge ?? "",
    ccfVisual,
    xcpcVisual,
  ].join("|");
}

function getEntryDate(entry?: UsernameHistoryEntry) {
  if (!entry) return null;
  const timestamp = entry.changedAt ? new Date(entry.changedAt) : null;
  return Number.isNaN(timestamp?.getTime() ?? Number.NaN) ? null : timestamp;
}

function formatDate(date: Date | null) {
  if (!date) return "未知";
  return DATE_FORMATTER.format(date);
}
