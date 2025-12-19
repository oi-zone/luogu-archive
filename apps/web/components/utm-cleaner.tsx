"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function UtmCleaner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (Array.from(searchParams.keys()).some((key) => key.startsWith("utm_"))) {
      const newParams = new URLSearchParams(searchParams.toString());

      const keysToDelete: string[] = [];
      newParams.forEach((_, key) => {
        if (key.startsWith("utm_")) keysToDelete.push(key);
      });
      keysToDelete.forEach((key) => newParams.delete(key));

      const queryString = newParams.toString();
      const cleanUrl = `${pathname}${queryString ? `?${queryString}` : ""}`;
      window.history.replaceState(null, "", cleanUrl);
    }
  }, [pathname, searchParams]);

  return null;
}
