"use client";

import * as React from "react";
import { enqueueJudgementRefresh } from "@/server-actions/queue-jobs";
import { Reply, SquareArrowOutUpRight, SquareCheckBig } from "lucide-react";
import Link from "next/link";

import type { OstrakonStat } from "@luogu-discussion-archive/query";

import { useClipboard } from "@/hooks/use-clipboard";
import { Button } from "@/components/ui/button";
import { QueueJobButton } from "@/components/operation-panel/queue-job-button";
import StatRow from "@/components/operation-panel/stat-row";

export default function OperationPanel({
  stat,
  className,
}: {
  stat: OstrakonStat;
  className?: string;
}) {
  const { copy: copyLink, copied: copiedLink } = useClipboard();
  const originalLink = "https://www.luogu.com.cn/judgement";
  const archiveLink = "https://luogu.store/ostraka";
  const triggerRefresh = React.useCallback(() => enqueueJudgementRefresh(), []);

  return (
    <div className={className}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">陶片放逐操作</h2>
      </div>

      <dl className="mt-6 space-y-3 text-sm text-foreground">
        <StatRow
          label="近期陶片"
          value={`${stat.recentJudgements.toLocaleString("zh-CN")}\u2009片`}
        />
        <StatRow
          label="已保存陶片"
          value={`${stat.totalJudgements.toLocaleString("zh-CN")}\u2009片`}
        />
        <StatRow
          label="被放逐用户"
          value={`${stat.judgedUsers.toLocaleString("zh-CN")}\u2009人`}
        />
      </dl>

      <div className="mt-6 grid gap-2">
        <Button asChild className="justify-start gap-2 rounded-2xl py-2">
          <Link href={originalLink} target="_blank" rel="noreferrer">
            <Reply className="size-4" aria-hidden="true" /> 查看原页面
          </Link>
        </Button>
        <QueueJobButton onTrigger={triggerRefresh} idleText="更新陶片放逐" />
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
      </div>
    </div>
  );
}
