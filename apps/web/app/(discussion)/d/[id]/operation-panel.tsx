"use client";

import * as React from "react";
import { enqueueDiscussionRefresh } from "@/server-actions/queue-jobs";
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

export default function DiscussionOperationPanel({
  discussion,
  className,
}: {
  discussion: {
    id: number;
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
  const { copy: copyTopicMarkdown, copied: copiedTopicMarkdown } =
    useClipboard();
  const openWayback = React.useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#wayback") return;
    window.location.hash = "wayback";
  }, []);
  const snapshotToken = discussion.capturedAt.getTime().toString(36);
  const originalLink = `https://www.luogu.com.cn/discuss/${discussion.id}`;
  const archiveLink = `https://luogu.store/d/${discussion.id}`;
  const archiveSnapshotLink = `https://luogu.store/d/${discussion.id}@${snapshotToken}`;
  const topicMarkdown = discussion.content ?? "";
  const triggerRefresh = React.useCallback(
    () => enqueueDiscussionRefresh(discussion.id),
    [discussion.id],
  );

  return (
    <div className={className}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">讨论操作</h2>
        <p className="text-sm text-muted-foreground">
          快速查看讨论及其快照的属性，并进行相关操作。
        </p>
      </div>

      <dl className="mt-6 space-y-3 text-sm text-foreground">
        <StatRow
          label="当前回复"
          value={`${discussion.replyCount.toLocaleString("zh-CN")}\u2009条`}
        />
        <StatRow
          label="当前快照"
          value={`${discussion.snapshotsCount.toLocaleString("zh-CN")}\u2009份`}
        />
        <StatRow
          label="快照标识符"
          value={`@${discussion.capturedAt.getTime().toString(36)}`}
        />
        <StatRow
          label="此快照首次捕获于"
          value={ABSOLUTE_DATE_FORMATTER.format(discussion.capturedAt)}
          hint={formatRelativeTime(discussion.capturedAt)}
        />
        <StatRow
          label="此快照最后确认于"
          value={ABSOLUTE_DATE_FORMATTER.format(discussion.lastSeenAt)}
          hint={formatRelativeTime(discussion.lastSeenAt)}
        />
      </dl>

      <div className="mt-6 grid gap-2">
        <Button asChild className="justify-start gap-2 rounded-2xl py-2">
          <Link href={originalLink} target="_blank" rel="noreferrer">
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
        <QueueJobButton onTrigger={triggerRefresh} idleText="更新帖子" />
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
          onClick={() => copyTopicMarkdown(topicMarkdown)}
          aria-live="polite"
        >
          {copiedTopicMarkdown ? (
            <ClipboardCheck className="size-4" aria-hidden="true" />
          ) : (
            <ClipboardCopy className="size-4" aria-hidden="true" />
          )}
          复制零楼 Markdown
        </Button>
      </div>
    </div>
  );
}
