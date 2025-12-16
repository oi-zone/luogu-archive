"use client";

import * as React from "react";
import {
  enqueueArticleRefresh,
  enqueueDiscussionRefresh,
  enqueueJudgementRefresh,
  enqueuePasteRefresh,
} from "@/server-actions/queue-jobs";
import {
  LoaderCircle,
  RefreshCcw,
  SquareCheckBig,
  TriangleAlert,
} from "lucide-react";

import {
  articleRegexes,
  captureFromFirstMatch,
  discussionRegexes,
  judgementRegexes,
  pasteRegexes,
} from "@/lib/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Detected =
  | { kind: "article"; id: string; label: string }
  | { kind: "discussion"; id: number; label: string }
  | { kind: "paste"; id: string; label: string }
  | { kind: "judgement"; id: null; label: string };

const STATUS_RESET_DELAY = 1500;
type Status = "idle" | "pending" | "success" | "error";

export function LinkIntake() {
  const [value, setValue] = React.useState("");
  const [detected, setDetected] = React.useState<Detected | null>(null);
  const [status, setStatus] = React.useState<Status>("idle");
  const resetTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    const nextDetected = detectLink(value);
    setDetected(nextDetected);
  }, [value]);

  const clearTimer = React.useCallback(() => {
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
  }, []);

  React.useEffect(() => clearTimer, [clearTimer]);

  const resetStatusLater = React.useCallback(() => {
    clearTimer();
    resetTimer.current = setTimeout(
      () => setStatus("idle"),
      STATUS_RESET_DELAY,
    );
  }, [clearTimer]);

  const onSubmit = React.useCallback(() => {
    if (!detected || !value.trim()) return;

    startTransition(async () => {
      setStatus("pending");
      try {
        switch (detected.kind) {
          case "article":
            await enqueueArticleRefresh(detected.id);
            break;
          case "discussion":
            await enqueueDiscussionRefresh(detected.id);
            break;
          case "paste":
            await enqueuePasteRefresh(detected.id);
            break;
          case "judgement":
            await enqueueJudgementRefresh();
            break;
          default:
            throw new Error("unsupported type");
        }
        setStatus("success");
        setValue("");
        setDetected(null);
        resetStatusLater();
      } catch (error) {
        console.error("enqueue failed", error);
        setStatus("error");
        resetStatusLater();
      }
    });
  }, [detected, resetStatusLater, startTransition, value]);

  const helperText = React.useMemo(() => {
    if (!value.trim()) return "";
    if (detected?.label) return detected.label;
    return "未识别到有效链接";
  }, [detected, value]);

  const buttonText = React.useMemo(() => {
    switch (status) {
      case "pending":
        return "正在加入保存队列";
      case "success":
        return "已加入保存队列";
      case "error":
        return "添加失败，点击重试";
      default:
        return "添加到保存队列";
    }
  }, [status]);

  const icon = React.useMemo(() => {
    switch (status) {
      case "pending":
        return (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        );
      case "success":
        return <SquareCheckBig className="size-4" aria-hidden="true" />;
      case "error":
        return <TriangleAlert className="size-4" aria-hidden="true" />;
      default:
        return <RefreshCcw className="size-4" aria-hidden="true" />;
    }
  }, [status]);

  const disabled = isPending || !detected || !value.trim();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-y-3 px-2">
      <div className="flex w-full flex-col gap-y-3 sm:flex-row sm:items-stretch">
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSubmit();
            }
          }}
          placeholder="粘贴洛谷链接，自动识别并加入保存队列"
          className="block h-12 flex-1 rounded-2xl px-5 py-3.5 text-center font-mono sm:rounded-l-3xl sm:rounded-r-none sm:text-left"
        />
        <Button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          variant="default"
          className="block h-12 min-w-48 cursor-pointer justify-center rounded-2xl sm:rounded-l-none sm:rounded-r-3xl"
          aria-live="polite"
          size="default"
        >
          <span className="flex items-center justify-center gap-2 pe-1.5">
            {icon}
            {buttonText}
          </span>
        </Button>
      </div>
      <div
        className="h-6 w-full px-1 text-center text-sm text-muted-foreground sm:text-left"
        aria-live="polite"
      >
        {helperText}
      </div>
    </div>
  );
}

function detectLink(raw: string): Detected | null {
  const input = raw.trim();
  if (!input) return null;

  const discussionMatch = captureFromFirstMatch(discussionRegexes, input);
  if (discussionMatch?.[1]) {
    const id = Number.parseInt(discussionMatch[1]!, 10);
    if (!Number.isNaN(id)) {
      return { kind: "discussion", id, label: `已识别到帖子 ${id}` };
    }
  }

  const articleMatch = captureFromFirstMatch(articleRegexes, input);
  if (articleMatch?.[1]) {
    const lid = articleMatch[1]!;
    return { kind: "article", id: lid, label: `已识别到文章 ${lid}` };
  }

  const pasteMatch = captureFromFirstMatch(pasteRegexes, input);
  if (pasteMatch?.[1]) {
    const pid = pasteMatch[1]!;
    return { kind: "paste", id: pid, label: `已识别到云剪贴板 ${pid}` };
  }

  const judgementMatch = captureFromFirstMatch(judgementRegexes, input);
  if (judgementMatch) {
    return { kind: "judgement", id: null, label: "已识别到陶片放逐" };
  }

  return null;
}
