"use client";

import * as React from "react";
import {
  History,
  Reply,
  SquareArrowOutUpRight,
  SquareCheckBig,
} from "lucide-react";
import Link from "next/link";

import { ABSOLUTE_DATE_FORMATTER, formatRelativeTime } from "@/lib/feed-data";
import { cn } from "@/lib/utils";
import { useClipboard } from "@/hooks/use-clipboard";
import { Button } from "@/components/ui/button";
import type { UserBasicInfo } from "@/components/user/user-inline-link";

type StatRowProps = {
  label: string;
  value: string;
  hint?: string;
};

function StatRow({ label, value, hint }: StatRowProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
      {hint ? (
        <span className="text-xs text-muted-foreground/70">{hint}</span>
      ) : null}
    </div>
  );
}

export default function PasteOperationPanel({
  paste,
  className,
}: {
  paste: {
    id: string;
    time: Date;
    public: boolean;
    capturedAt: Date;
    lastSeenAt: Date;
    snapshotsCount: number;
    author: UserBasicInfo;
  };
  className?: string;
}) {
  const { copy: copyLink, copied: copiedLink } = useClipboard();
  const { copy: copySnapshotLink, copied: copiedSnapshotLink } = useClipboard();
  const openWayback = React.useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#wayback") return;
    window.location.hash = "wayback";
  }, []);

  return (
    <div
      className={cn(
        "rounded-3xl border border-border bg-background px-5 py-4 shadow-sm",
        className,
      )}
    >
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">云剪贴板操作</h2>
        <p className="text-sm text-muted-foreground">
          由 {paste.author.name} 于 {ABSOLUTE_DATE_FORMATTER.format(paste.time)}{" "}
          创建，当前
          {paste.public ? "公开" : "私密"}。
        </p>
      </div>

      <dl className="mt-6 space-y-3 text-sm text-foreground">
        <StatRow
          label="当前快照"
          value={`${paste.snapshotsCount.toLocaleString("zh-CN")}\u2009份`}
        />
        <StatRow
          label="快照标识符"
          value={`@${paste.capturedAt.getTime().toString(36)}`}
        />
        <StatRow
          label="此快照首次捕获于"
          value={ABSOLUTE_DATE_FORMATTER.format(paste.capturedAt)}
          hint={formatRelativeTime(paste.capturedAt)}
        />
        <StatRow
          label="此快照最后确认于"
          value={ABSOLUTE_DATE_FORMATTER.format(paste.lastSeenAt)}
          hint={formatRelativeTime(paste.lastSeenAt)}
        />
      </dl>

      <div className="mt-6 grid gap-2">
        <Button asChild className="justify-start gap-2 rounded-2xl py-2">
          <Link
            href={`https://www.luogu.com.cn/paste/${paste.id}`}
            target="_blank"
            rel="noreferrer"
          >
            <Reply className="size-4" aria-hidden="true" /> 查看原帖
          </Link>
        </Button>
        <Button
          variant="outline"
          className="justify-start gap-2 rounded-2xl py-2"
          type="button"
          onClick={openWayback}
        >
          <History className="size-4" aria-hidden="true" /> 时光机
        </Button>
        <Button
          variant="outline"
          className="cursor-pointer justify-start gap-2 rounded-2xl py-2"
          type="button"
          onClick={() => copyLink(`https://luogu.store/p/${paste.id}`)}
          aria-live="polite"
        >
          {copiedLink ? (
            <SquareCheckBig className="size-4" aria-hidden="true" />
          ) : (
            <SquareArrowOutUpRight className="size-4" aria-hidden="true" />
          )}
          复制链接
        </Button>
        <Button
          variant="outline"
          className="cursor-pointer justify-start gap-2 rounded-2xl py-2"
          type="button"
          onClick={() =>
            copySnapshotLink(
              `https://luogu.store/p/${paste.id}@${paste.capturedAt.getTime().toString(36)}`,
            )
          }
          aria-live="polite"
        >
          {copiedSnapshotLink ? (
            <SquareCheckBig className="size-4" aria-hidden="true" />
          ) : (
            <SquareArrowOutUpRight className="size-4" aria-hidden="true" />
          )}
          复制快照链接
        </Button>
      </div>
    </div>
  );
}
