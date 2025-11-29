"use client";

import {
  Children,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

interface MasonryColumnsProps {
  children: ReactNode;
  className?: string;
  gapPx?: number;
}

const DEFAULT_GAP = 24;
const BREAKPOINTS = {
  md: 768,
  xl: 1280,
  "3xl": 1920,
};

export function MasonryColumns({
  children,
  className,
  gapPx = DEFAULT_GAP,
}: MasonryColumnsProps) {
  const items = useMemo(() => Children.toArray(children), [children]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [columnCount, setColumnCount] = useState(1);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [itemHeights, setItemHeights] = useState<number[]>([]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const updateWidth = () => {
      setContainerWidth(node.clientWidth);
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      setContainerWidth(entry.contentRect.width);
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const queries = [
      {
        columns: 4,
        mql: window.matchMedia(`(min-width: ${BREAKPOINTS["3xl"]}px)`),
      },
      {
        columns: 3,
        mql: window.matchMedia(`(min-width: ${BREAKPOINTS.xl}px)`),
      },
      {
        columns: 2,
        mql: window.matchMedia(`(min-width: ${BREAKPOINTS.md}px)`),
      },
    ];

    const updateColumns = () => {
      const match = queries.find((query) => query.mql.matches);
      setColumnCount(match?.columns ?? 1);
    };

    const add = (mql: MediaQueryList, handler: () => void) => {
      if (typeof mql.addEventListener === "function") {
        mql.addEventListener("change", handler);
      } else {
        mql.addListener(handler);
      }
    };

    const remove = (mql: MediaQueryList, handler: () => void) => {
      if (typeof mql.removeEventListener === "function") {
        mql.removeEventListener("change", handler);
      } else {
        mql.removeListener(handler);
      }
    };

    updateColumns();
    queries.forEach(({ mql }) => add(mql, updateColumns));
    return () => {
      queries.forEach(({ mql }) => remove(mql, updateColumns));
    };
  }, []);

  useEffect(() => {
    if (!items.length) {
      return;
    }

    if (typeof ResizeObserver === "undefined") {
      setItemHeights(
        itemRefs.current.map(
          (node) => node?.getBoundingClientRect().height ?? 0,
        ),
      );
      return;
    }

    const observers = itemRefs.current.map((node, index) => {
      if (!node) {
        return null;
      }

      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        setItemHeights((prev) => {
          const next = [...prev];
          next[index] = entry.contentRect.height;
          return next;
        });
      });

      observer.observe(node);
      return observer;
    });

    return () => {
      observers.forEach((observer) => observer?.disconnect());
    };
  }, [items.length]);

  const layout = useMemo(() => {
    if (columnCount <= 1 || containerWidth === 0) {
      return null;
    }

    const columnWidth = Math.max(
      (containerWidth - gapPx * (columnCount - 1)) / columnCount,
      0,
    );

    const columnHeights = new Array(columnCount).fill(0);
    const positions = items.map((_, index) => {
      const columnIndex = index % columnCount;
      const left = columnIndex * (columnWidth + gapPx);
      const top = columnHeights[columnIndex];
      const height = itemHeights[index] ?? 0;
      columnHeights[columnIndex] = top + height + gapPx;
      return { left, top };
    });

    const occupiedHeight = columnHeights.length
      ? Math.max(...columnHeights) - gapPx
      : 0;

    return {
      columnWidth,
      height: Math.max(0, occupiedHeight),
      positions,
    };
  }, [columnCount, containerWidth, gapPx, itemHeights, items]);

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      style={layout ? { height: `${layout.height}px` } : undefined}
    >
      {items.map((child, index) => {
        const key = (child as ReactElement)?.key ?? index;
        const style = layout
          ? {
              position: "absolute" as const,
              width: `${layout.columnWidth}px`,
              transform: `translate(${layout.positions[index].left}px, ${layout.positions[index].top}px)`,
            }
          : {
              marginBottom: `${gapPx}px`,
            };

        return (
          <div
            key={key}
            ref={(node) => {
              itemRefs.current[index] = node;
            }}
            style={style}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}
