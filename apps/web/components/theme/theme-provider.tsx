"use client";

import * as React from "react";

type ThemeSetting = "light" | "dark" | "system";

type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  setting: ThemeSetting;
  resolved: ResolvedTheme;
  setSetting: (setting: ThemeSetting) => void;
};

const STORAGE_KEY = "theme-preference";

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [setting, setSetting] = React.useState<ThemeSetting>("system");
  const [systemTheme, setSystemTheme] = React.useState<ResolvedTheme>("light");

  const applyTheme = React.useCallback(
    (nextSetting: ThemeSetting, nextSystemTheme: ResolvedTheme) => {
      if (typeof document === "undefined") return;
      const resolved = nextSetting === "system" ? nextSystemTheme : nextSetting;
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      if (resolved === "dark") {
        root.classList.add("dark");
      }
      root.dataset.theme = resolved;
    },
    [],
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = window.localStorage.getItem(
      STORAGE_KEY,
    ) as ThemeSetting | null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      setSetting(stored);
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const legacyMedia = media as MediaQueryList & {
      addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    };
    const applyMedia = (target: { matches: boolean }) => {
      setSystemTheme(target.matches ? "dark" : "light");
    };

    applyMedia(media);

    const listener = (event: MediaQueryListEvent) => applyMedia(event);

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", listener);
    } else if (typeof legacyMedia.addListener === "function") {
      legacyMedia.addListener(listener);
    }

    return () => {
      if (typeof media.removeEventListener === "function") {
        media.removeEventListener("change", listener);
      } else if (typeof legacyMedia.removeListener === "function") {
        legacyMedia.removeListener(listener);
      }
    };
  }, []);

  React.useEffect(() => {
    applyTheme(setting, systemTheme);
    if (typeof window === "undefined") return;

    if (setting === "system") {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, setting);
    }
  }, [applyTheme, setting, systemTheme]);

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      setting,
      resolved: setting === "system" ? systemTheme : setting,
      setSetting,
    }),
    [setting, systemTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
