"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const modes: Array<{
  value: "light" | "dark" | "system";
  label: string;
  Icon: typeof Sun;
}> = [
  { value: "light", label: "浅色模式", Icon: Sun },
  { value: "dark", label: "深色模式", Icon: Moon },
  { value: "system", label: "自动模式", Icon: Monitor },
];

const order = modes.map((mode) => mode.value);

export function ThemeToggle() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const { theme, setTheme: setSetting } = useTheme();
  const setting =
    (mounted && (theme as "light" | "dark" | "system")) || "system";

  const handleToggle = React.useCallback(() => {
    const currentIndex = order.indexOf(setting);
    const nextSetting = order[(currentIndex + 1) % order.length];
    setSetting(nextSetting);
  }, [setting, setSetting]);

  const nextSetting = order[(order.indexOf(setting) + 1) % order.length];
  const currentLabel =
    modes.find((mode) => mode.value === setting)?.label ?? "浅色模式";
  const nextLabel =
    modes.find((mode) => mode.value === nextSetting)?.label ?? "深色模式";

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      className="group flex cursor-pointer items-center gap-1.5 rounded-full border border-border/70 bg-background/90 px-3 py-1.5 text-muted-foreground shadow-sm transition duration-200 hover:border-border hover:text-foreground"
      aria-label={`当前主题：${currentLabel}。点击切换为${nextLabel}`}
    >
      <span className="sr-only">当前主题：{currentLabel}</span>
      {modes.map(({ value, Icon }) => (
        <Icon
          key={value}
          className={cn(
            "size-4 transition-all",
            mounted && value === setting
              ? "text-foreground opacity-100"
              : "opacity-40 group-hover:opacity-60",
          )}
        />
      ))}
    </Button>
  );
}
