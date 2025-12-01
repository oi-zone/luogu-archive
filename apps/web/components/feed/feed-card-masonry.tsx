"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

import {
  FEED_MASONRY_DEFAULT_COLUMN_COUNT,
  useResponsiveColumnCount,
} from "./use-responsive-column-count";

export function FeedCardMasonry({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const items = React.useMemo(
    () => React.Children.toArray(children),
    [children],
  );
  const columnCount = useResponsiveColumnCount();

  const columns = React.useMemo(() => {
    const bucketCount = Math.max(
      FEED_MASONRY_DEFAULT_COLUMN_COUNT,
      columnCount,
    );
    const buckets: React.ReactNode[][] = Array.from(
      { length: bucketCount },
      () => [],
    );
    items.forEach((item, index) => {
      buckets[index % bucketCount].push(item);
    });
    return buckets;
  }, [items, columnCount]);

  return (
    <div
      className={cn("grid gap-6", className)}
      style={{
        gridTemplateColumns: `repeat(${Math.max(FEED_MASONRY_DEFAULT_COLUMN_COUNT, columnCount)}, minmax(0, 1fr))`,
      }}
    >
      {columns.map((columnItems, columnIndex) => (
        <div key={`feed-column-${columnIndex}`} className="flex flex-col gap-6">
          {columnItems.map((item, itemIndex) => (
            <React.Fragment
              key={
                React.isValidElement(item) && item.key != null
                  ? item.key
                  : `${columnIndex}-${itemIndex}`
              }
            >
              {item}
            </React.Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}
