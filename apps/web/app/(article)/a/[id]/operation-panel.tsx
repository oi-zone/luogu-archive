"use client";

import * as React from "react";
import { enqueueArticleRefresh } from "@/server-actions/queue-jobs";
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
import { cn } from "@/lib/utils";
import { useClipboard } from "@/hooks/use-clipboard";
import { Button } from "@/components/ui/button";
import { QueueJobButton } from "@/components/operation-panel/queue-job-button";
import StatRow from "@/components/operation-panel/stat-row";

export default function ArticleOperationPanel({
  article,
  className,
}: {
  article: {
    lid: string;
    title: string;
    content: string | null;
    replyCount: number;
    capturedAt: Date;
    lastSeenAt: Date;
    snapshotsCount: number;
  };
  className?: string;
}) {
  const { copy: copyLink, copied: copiedLink } = useClipboard();
  const { copy: copySnapshotLink, copied: copiedSnapshotLink } = useClipboard();
  const { copy: copyBodyMarkdown, copied: copiedBodyMarkdown } = useClipboard();
  const openWayback = React.useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#wayback") return;
    window.location.hash = "wayback";
  }, []);
  const snapshotToken = article.capturedAt.getTime().toString(36);
  const originalLink = `https://www.luogu.com.cn/article/${article.lid}`;
  const archiveLink = `https://luogu.store/a/${article.lid}`;
  const archiveSnapshotLink = `https://luogu.store/a/${article.lid}@${snapshotToken}`;
  const bodyMarkdown = article.content ?? "";
  const triggerRefresh = React.useCallback(
    () => enqueueArticleRefresh(article.lid),
    [article.lid],
  );

  return (
    <div className={className}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">文章操作</h2>
        <p className="text-sm text-muted-foreground">
          快速查看文章及其快照的属性，并进行相关操作。
        </p>
      </div>

      <dl className="mt-6 space-y-3 text-sm text-foreground">
        <StatRow
          label="当前回复"
          value={`${article.replyCount.toLocaleString("zh-CN")}\u2009条`}
        />
        <StatRow
          label="当前快照"
          value={`${article.snapshotsCount.toLocaleString("zh-CN")}\u2009份`}
        />
        <StatRow
          label="快照标识符"
          value={`@${article.capturedAt.getTime().toString(36)}`}
        />
        <StatRow
          label="此快照首次捕获于"
          value={ABSOLUTE_DATE_FORMATTER.format(article.capturedAt)}
          hint={formatRelativeTime(article.capturedAt)}
        />
        <StatRow
          label="此快照最后确认于"
          value={ABSOLUTE_DATE_FORMATTER.format(article.lastSeenAt)}
          hint={formatRelativeTime(article.lastSeenAt)}
        />
      </dl>

      <div className="mt-6 grid gap-2">
        <Button asChild className="justify-start gap-2 rounded-2xl py-2">
          <Link href={originalLink} target="_blank" rel="noreferrer noopener">
            <Reply className="size-4" aria-hidden="true" /> 查看原文
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
        <QueueJobButton onTrigger={triggerRefresh} idleText="更新文章" />
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
          onClick={() => copyBodyMarkdown(bodyMarkdown)}
          aria-live="polite"
        >
          {copiedBodyMarkdown ? (
            <ClipboardCheck className="size-4" aria-hidden="true" />
          ) : (
            <ClipboardCopy className="size-4" aria-hidden="true" />
          )}
          复制正文 Markdown
        </Button>
      </div>
    </div>
  );
}
