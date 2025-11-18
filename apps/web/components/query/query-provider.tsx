"use client";

import * as React from "react";
import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

const DEFAULT_STALE_TIME = 3 * 60 * 1000; // 3 minutes
const DEFAULT_GC_TIME = 15 * 60 * 1000; // 15 minutes

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: DEFAULT_STALE_TIME,
            gcTime: DEFAULT_GC_TIME,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            refetchInterval: DEFAULT_STALE_TIME,
            refetchIntervalInBackground: true,
          },
        },
      }),
  );

  React.useEffect(() => {
    function handleVisibilityChange() {
      focusManager.setFocused(!document.hidden);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
