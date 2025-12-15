"use client";

import * as React from "react";
import {
  LoaderCircle,
  RefreshCcw,
  SquareCheckBig,
  TriangleAlert,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type QueueJobButtonProps = {
  onTrigger: () => Promise<void>;
  idleText: string;
  pendingText?: string;
  successText?: string;
  errorText?: string;
  className?: string;
};

const STATUS_RESET_DELAY = 1500;

type Status = "idle" | "success" | "error";

export function QueueJobButton({
  onTrigger,
  idleText,
  pendingText = "正在加入更新队列",
  successText = "更新任务已创建",
  errorText = "任务创建失败，点击重试",
  className,
}: QueueJobButtonProps) {
  const [status, setStatus] = React.useState<Status>("idle");
  const [isPending, startTransition] = React.useTransition();
  const resetTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = React.useCallback(() => {
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
  }, []);

  React.useEffect(() => clearTimer, [clearTimer]);

  const runTrigger = React.useCallback(() => {
    startTransition(async () => {
      clearTimer();
      setStatus("idle");
      try {
        await onTrigger();
        setStatus("success");
        resetTimer.current = setTimeout(() => {
          setStatus("idle");
          resetTimer.current = null;
        }, STATUS_RESET_DELAY);
      } catch {
        setStatus("error");
      }
    });
  }, [clearTimer, onTrigger]);

  const icon = isPending ? (
    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
  ) : status === "success" ? (
    <SquareCheckBig className="size-4" aria-hidden="true" />
  ) : status === "error" ? (
    <TriangleAlert className="size-4" aria-hidden="true" />
  ) : (
    <RefreshCcw className="size-4" aria-hidden="true" />
  );

  const text = isPending
    ? pendingText
    : status === "success"
      ? successText
      : status === "error"
        ? errorText
        : idleText;

  return (
    <Button
      variant="outline"
      type="button"
      className={cn("justify-start gap-2 rounded-2xl py-2", className)}
      onClick={runTrigger}
      disabled={isPending}
      aria-live="polite"
    >
      {icon}
      {text}
    </Button>
  );
}
