import { Search } from "lucide-react";
import Link from "next/link";

import {
  getHotDiscussions,
  HOT_DISCUSSION_DEFAULT_LIMIT,
  HOT_DISCUSSION_DEFAULT_WINDOW_MS,
  type HotDiscussionSummary,
} from "@luogu-discussion-archive/query";

import { ABSOLUTE_DATE_FORMATTER, formatRelativeTime } from "@/lib/feed-data";
import { Badge } from "@/components/ui/badge";
import UserInlineLink from "@/components/user/user-inline-link";

const WINDOW_LABEL = formatWindowLabel(HOT_DISCUSSION_DEFAULT_WINDOW_MS);

export default async function DiscussionsPage() {
  const discussions = await getHotDiscussions();

  return (
    <div className="flex flex-1 flex-col gap-8 px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm font-medium">讨论区</p>
            <h1 className="text-3xl font-semibold tracking-tight">热门讨论</h1>
            <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
              基于最近 {WINDOW_LABEL}
              内的回复增量，实时筛选前 {HOT_DISCUSSION_DEFAULT_LIMIT}{" "}
              条讨论；用于快速了解正在被热烈回应的话题。
            </p>
          </div>
          <Link
            href="/search?category=discussion"
            scroll={false}
            prefetch={false}
            className="bg-muted/40 text-foreground/80 hover:text-foreground border-border focus-visible:ring-primary/20 focus-visible:ring-offset-background relative flex h-12 w-full items-center rounded-2xl border px-4 text-sm transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 sm:w-72"
          >
            <Search className="text-muted-foreground absolute left-4 top-1/2 size-4 -translate-y-1/2" />
            <span className="pl-8">搜索讨论、作者或标签…</span>
          </Link>
        </div>
        <div className="text-muted-foreground text-sm">
          {discussions.length === 0
            ? "暂时没有满足条件的讨论"
            : `共 ${discussions.length} 条记录 · 数据每次访问实时计算`}
        </div>
      </header>

      <section className="space-y-4">
        {discussions.map((discussion) => (
          <DiscussionCard key={discussion.id} discussion={discussion} />
        ))}
        {discussions.length === 0 && (
          <div className="text-muted-foreground rounded-3xl border border-dashed p-8 text-center text-sm">
            暂无热门讨论，稍后再来看看吧。
          </div>
        )}
      </section>
    </div>
  );
}

function DiscussionCard({ discussion }: { discussion: HotDiscussionSummary }) {
  const href = `/d/${discussion.id}`;
  const hasAuthor = Boolean(discussion.author);

  return (
    <Link href={href} scroll={false} prefetch={false} className="block">
      <article className="bg-card border-border text-card-foreground relative overflow-hidden rounded-3xl border p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-violet-500/10 text-violet-600 dark:text-violet-200">
              {discussion.snapshot.forum.name}
            </Badge>
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-200">
              近 {WINDOW_LABEL} +{discussion.recentReplyCount} 回复
            </Badge>
          </div>
          <time
            className="text-muted-foreground text-xs"
            dateTime={discussion.updatedAt.toISOString()}
          >
            {formatRelativeTime(discussion.updatedAt)} 更新
          </time>
        </div>

        <div className="mt-4 space-y-3">
          <h3 className="text-foreground text-xl font-semibold leading-tight">
            {discussion.snapshot.title}
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            累计 {discussion.replyCount.toLocaleString("zh-CN")} 条回复 ·
            最近回帖 +{discussion.recentReplyCount}。
          </p>
        </div>

        <div className="text-muted-foreground mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          {hasAuthor ? (
            <UserInlineLink user={discussion.author!} compact avatar />
          ) : (
            <span className="text-muted-foreground">作者未知</span>
          )}
          <span>发布于 {ABSOLUTE_DATE_FORMATTER.format(discussion.time)}</span>
        </div>
      </article>
    </Link>
  );
}

function formatWindowLabel(ms: number) {
  if (ms % 86400000 === 0) {
    return `${ms / 86400000} 天`;
  }

  if (ms % 3600000 === 0) {
    return `${ms / 3600000} 小时`;
  }

  return `${Math.round(ms / 3600000)} 小时`;
}
