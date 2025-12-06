"use client";

import * as React from "react";
import { enqueuePasteRefresh } from "@/server-actions/queue-jobs";
import {
  ClipboardCheck,
  ClipboardCopy,
  History,
  Reply,
  SquareArrowOutUpRight,
  SquareCheckBig,
} from "lucide-react";
import Link from "next/link";

import { ABSOLUTE_DATE_FORMATTER, formatRelativeTime } from "@/lib/time";
import { useClipboard } from "@/hooks/use-clipboard";
import { Button } from "@/components/ui/button";
import { QueueJobButton } from "@/components/operation-panel/queue-job-button";
import StatRow from "@/components/operation-panel/stat-row";
import type { UserBasicInfo } from "@/components/user/user-inline-link";

export default function PasteOperationPanel({
  paste,
  className,
}: {
  paste: {
    id: string;
    time: Date;
    public: boolean;
    content: string | null;
    capturedAt: Date;
    lastSeenAt: Date;
    snapshotsCount: number;
    author: UserBasicInfo;
  };
  className?: string;
}) {
  const { copy: copyLink, copied: copiedLink } = useClipboard();
  const { copy: copySnapshotLink, copied: copiedSnapshotLink } = useClipboard();
  const { copy: copySourceMarkdown, copied: copiedSourceMarkdown } =
    useClipboard();
  const openWayback = React.useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#wayback") return;
    window.location.hash = "wayback";
  }, []);
  const snapshotToken = paste.capturedAt.getTime().toString(36);
  const originalLink = `https://www.luogu.com.cn/paste/${paste.id}`;
  const archiveLink = `https://luogu.store/p/${paste.id}`;
  const archiveSnapshotLink = `https://luogu.store/p/${paste.id}@${snapshotToken}`;
  const sourceMarkdown = paste.content ?? "";
  const triggerRefresh = React.useCallback(
    () => enqueuePasteRefresh(paste.id),
    [paste.id],
  );

  return (
    <div className={className}>
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
          <Link href={originalLink} target="_blank" rel="noreferrer">
            <Reply className="size-4" aria-hidden="true" /> 查看原剪贴板
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
        <QueueJobButton onTrigger={triggerRefresh} idleText="更新云剪贴板" />
        <Button
          variant="outline"
          className="cursor-pointer justify-start gap-2 rounded-2xl py-2"
          type="button"
          onClick={() => copyLink(archiveLink)}
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
          onClick={() => copySnapshotLink(archiveSnapshotLink)}
          aria-live="polite"
        >
          {copiedSnapshotLink ? (
            <SquareCheckBig className="size-4" aria-hidden="true" />
          ) : (
            <SquareArrowOutUpRight className="size-4" aria-hidden="true" />
          )}
          复制快照链接
        </Button>
        <Button
          variant="outline"
          className="cursor-pointer justify-start gap-2 rounded-2xl py-2"
          type="button"
          onClick={() => copySourceMarkdown(sourceMarkdown)}
          aria-live="polite"
        >
          {copiedSourceMarkdown ? (
            <ClipboardCheck className="size-4" aria-hidden="true" />
          ) : (
            <ClipboardCopy className="size-4" aria-hidden="true" />
          )}
          复制 Markdown 源代码
        </Button>
      </div>
    </div>
  );
}
