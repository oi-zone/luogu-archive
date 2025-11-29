"use client";

import * as React from "react";
import QueuePage from "@/app/queue/page";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export default function QueueModal() {
  const router = useRouter();

  const close = React.useCallback(() => {
    if (window.history.length <= 1) {
      router.push("/");
      return;
    }
    router.back();
  }, [router]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [close]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm sm:p-8"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="保存队列"
        className="relative flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-border bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-10 rounded-full bg-background/80 shadow-lg backdrop-blur"
          onClick={close}
        >
          <X className="size-5" aria-hidden />
          <span className="sr-only">关闭保存队列</span>
        </Button>
        <div className="flex-1 overflow-y-auto">
          <QueuePage />
        </div>
      </div>
    </div>
  );
}
