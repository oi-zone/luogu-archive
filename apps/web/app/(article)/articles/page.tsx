import { Search } from "lucide-react";
import Link from "next/link";

import {
  FEATURED_ARTICLE_DEFAULT_LIMIT,
  getFeaturedArticles,
  type FeaturedArticleSummary,
  type FeedEntry,
} from "@luogu-discussion-archive/query";

import { FeedCardMasonry } from "@/components/feed/feed-card-masonry";
import { FeedCard } from "@/components/feed/feed-item";

export const dynamic = "force-dynamic";

export default async function ArticlesPage() {
  let articles: FeaturedArticleSummary[] = [];
  let loadError = false;
  try {
    articles = await getFeaturedArticles();
  } catch (error) {
    loadError = true;
    console.error("Failed to load featured articles", error);
  }

  const entries = articles.map(articleToFeedEntry);

  return (
    <div className="flex flex-1 flex-col gap-8 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              文章列表
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">精选文章</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              依照评论、点赞、收藏的综合得分，实时列出前{" "}
              {FEATURED_ARTICLE_DEFAULT_LIMIT} 篇文章。
            </p>
          </div>
          <Link
            href="/search?category=article"
            scroll={false}
            prefetch={false}
            className="relative flex h-12 w-full items-center rounded-2xl border border-border bg-muted/40 px-4 text-sm text-foreground/80 transition hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none sm:w-72"
          >
            <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
            <span className="pl-8">搜索文章、作者或话题…</span>
          </Link>
        </div>
        <div className="text-sm text-muted-foreground">
          {loadError
            ? "精选文章列表暂时不可用，请稍后再试。"
            : articles.length === 0
              ? "暂时没有符合条件的文章"
              : `共 ${articles.length} 篇 · 得分与数据按需实时刷新`}
        </div>
      </header>

      <section className="flex flex-col gap-4">
        {articles.length > 0 ? (
          <FeedCardMasonry>
            {entries.map((entry) => (
              <FeedCard key={entry.key} item={entry} />
            ))}
          </FeedCardMasonry>
        ) : (
          <div className="rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {loadError
              ? "暂时无法获取精选文章数据，刷新页面或稍后重试。"
              : "暂无数据，等候新文章发布后再试。"}
          </div>
        )}
      </section>
    </div>
  );
}

function articleToFeedEntry(article: FeaturedArticleSummary): FeedEntry {
  return {
    kind: "article",
    key: `featured-article:${article.lid}`,
    timestamp: article.updatedAt.toISOString(),
    author: article.author,
    articleId: article.lid,
    title: article.snapshot.title,
    category: article.category,
    replyCount: article.replyCount,
    recentReplyCount: article.recentReplyCount,
    favorCount: article.favorCount,
    upvote: article.upvote,
  } satisfies FeedEntry;
}
