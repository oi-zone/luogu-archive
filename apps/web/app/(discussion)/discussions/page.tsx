import { Search } from "lucide-react";
import Link from "next/link";

import {
  getHotDiscussions,
  HOT_DISCUSSION_DEFAULT_LIMIT,
  HOT_DISCUSSION_DEFAULT_WINDOW_MS,
  type FeedEntry,
  type HotDiscussionSummary,
} from "@luogu-discussion-archive/query";

import { FeedCardMasonry } from "@/components/feed/feed-card-masonry";
import { FeedCard } from "@/components/feed/feed-item";

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

  const entries = discussions.map(discussionToFeedEntry);

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
            className="relative !hidden flex h-12 w-full items-center rounded-2xl border border-border bg-muted/40 px-4 text-sm text-foreground/80 transition hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none sm:w-72"
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
          <FeedCardMasonry>
            {entries.map((entry) => (
              <FeedCard key={entry.key} item={entry} />
            ))}
          </FeedCardMasonry>
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

function discussionToFeedEntry(discussion: HotDiscussionSummary): FeedEntry {
  return {
    kind: "discussion",
    key: `hot-discussion:${discussion.id}`,
    timestamp: discussion.updatedAt.toISOString(),
    author: discussion.author,
    postId: discussion.id,
    title: discussion.snapshot.title,
    forumSlug: discussion.snapshot.forum.slug,
    forumName: discussion.snapshot.forum.name,
    replyCount: discussion.replyCount,
    recentReplyCount: discussion.recentReplyCount,
  } satisfies FeedEntry;
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
