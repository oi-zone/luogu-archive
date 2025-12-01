"use client";

import * as React from "react";

export const FEED_MASONRY_DEFAULT_COLUMN_COUNT = 1;

function resolveColumnCount(width: number) {
  if (width >= 2000) return 5;
  if (width >= 1600) return 4;
  if (width >= 1200) return 3;
  if (width >= 800) return 2;
  return FEED_MASONRY_DEFAULT_COLUMN_COUNT;
}

export function useResponsiveColumnCount() {
  const [count, setCount] = React.useState(FEED_MASONRY_DEFAULT_COLUMN_COUNT);

  React.useEffect(() => {
    function update() {
      setCount(resolveColumnCount(window.innerWidth));
    }

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return count;
}
