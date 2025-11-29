import { Search } from "lucide-react";
import Link from "next/link";

import {
  getHotDiscussions,
  HOT_DISCUSSION_DEFAULT_LIMIT,
  HOT_DISCUSSION_DEFAULT_WINDOW_MS,
  type HotDiscussionSummary,
} from "@luogu-discussion-archive/query";

import { ABSOLUTE_DATE_FORMATTER, formatRelativeTime } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { MasonryColumns } from "@/components/layout/masonry-columns";
import UserInlineLink from "@/components/user/user-inline-link";

const WINDOW_LABEL = formatWindowLabel(HOT_DISCUSSION_DEFAULT_WINDOW_MS);

export const dynamic = "force-dynamic";

export default async function DiscussionsPage() {
  let discussions: HotDiscussionSummary[] = [];
  let loadError = false;
  try {
    discussions = await getHotDiscussions();
  } catch (error) {
    loadError = true;
    console.error("Failed to load hot discussions", error);
  }

  return (
    <div className="flex flex-1 flex-col gap-8 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">讨论区</p>
            <h1 className="text-3xl font-semibold tracking-tight">热门讨论</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              基于最近 {WINDOW_LABEL}
              内的回复增量，实时筛选前 {HOT_DISCUSSION_DEFAULT_LIMIT}{" "}
              条讨论；用于快速了解正在被热烈回应的话题。
            </p>
          </div>
          <Link
            href="/search?category=discussion"
            scroll={false}
            prefetch={false}
            className="relative flex h-12 w-full items-center rounded-2xl border border-border bg-muted/40 px-4 text-sm text-foreground/80 transition hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none sm:w-72"
          >
            <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
            <span className="pl-8">搜索讨论、作者或标签…</span>
          </Link>
        </div>
        <div className="text-sm text-muted-foreground">
          {loadError
            ? "热门讨论列表暂时不可用，请稍后再试。"
            : discussions.length === 0
              ? "暂时没有满足条件的讨论"
              : `共 ${discussions.length} 条记录 · 数据每次访问实时计算`}
        </div>
      </header>

      <section className="flex flex-col gap-4">
        {discussions.length > 0 ? (
          <MasonryColumns>
            {discussions.map((discussion) => (
              <DiscussionCard key={discussion.id} discussion={discussion} />
            ))}
          </MasonryColumns>
        ) : (
          <div className="rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {loadError
              ? "暂时无法获取热门讨论数据，刷新页面或稍后重试。"
              : "暂无热门讨论，稍后再来看看吧。"}
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
    <article className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
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
          className="text-xs text-muted-foreground"
          dateTime={discussion.updatedAt.toISOString()}
        >
          {formatRelativeTime(discussion.updatedAt)} 更新
        </time>
      </div>

      <div className="mt-4 space-y-3">
        <h3 className="text-xl leading-tight font-semibold text-foreground">
          <Link href={href} scroll={false} prefetch={false}>
            {discussion.snapshot.title}
            <div className="absolute inset-0" />
          </Link>
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          累计 {discussion.replyCount.toLocaleString("zh-CN")} 条回复 · 最近回帖
          +{discussion.recentReplyCount}。
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {hasAuthor ? (
          <UserInlineLink
            className="z-10"
            user={discussion.author!}
            compact
            avatar
          />
        ) : (
          <span className="text-muted-foreground">作者未知</span>
        )}
        <span>发布于 {ABSOLUTE_DATE_FORMATTER.format(discussion.time)}</span>
      </div>
    </article>
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
