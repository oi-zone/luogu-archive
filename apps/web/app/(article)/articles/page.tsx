import { Award, Search } from "lucide-react";
import Link from "next/link";

import {
  FEATURED_ARTICLE_DEFAULT_LIMIT,
  FEATURED_ARTICLE_DEFAULT_WINDOW_MS,
  getFeaturedArticles,
  type FeaturedArticleSummary,
} from "@luogu-discussion-archive/query";

import { ABSOLUTE_DATE_FORMATTER, formatRelativeTime } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { MasonryColumns } from "@/components/layout/masonry-columns";
import UserInlineLink from "@/components/user/user-inline-link";

const SCORE_FORMATTER = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const WINDOW_LABEL = formatWindowLabel(FEATURED_ARTICLE_DEFAULT_WINDOW_MS);

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
          <MasonryColumns>
            {articles.map((article, index) => (
              <ArticleCard
                key={article.lid}
                article={article}
                rank={index + 1}
              />
            ))}
          </MasonryColumns>
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

function ArticleCard({
  article,
  rank,
}: {
  article: FeaturedArticleSummary;
  rank: number;
}) {
  const href = `/a/${article.lid}`;
  const hasAuthor = Boolean(article.author);
  const formattedScore = SCORE_FORMATTER.format(article.score);

  return (
    <article className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge className="bg-sky-500/10 text-sky-600 dark:text-sky-200">
          TOP {rank}
        </Badge>
        <div className="flex items-center gap-2">
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-200">
            综合得分 {formattedScore}
          </Badge>
          <Award className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <h3 className="text-xl leading-tight font-semibold text-foreground">
          <Link href={href} scroll={false} prefetch={false}>
            {article.snapshot.title}
            <div className="absolute inset-0" />
          </Link>
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          收藏 {article.favorCount.toLocaleString("zh-CN")} · 回复{" "}
          {article.replyCount.toLocaleString("zh-CN")} · 赞同{" "}
          {article.upvote.toLocaleString("zh-CN")}。
          {article.recentReplyCount > 0 && (
            <span className="ms-1 inline-flex items-center text-foreground/80">
              近 {WINDOW_LABEL} +{article.recentReplyCount} 条评论
            </span>
          )}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {hasAuthor ? (
          <UserInlineLink user={article.author!} compact avatar />
        ) : (
          <span className="text-muted-foreground">作者未知</span>
        )}
        <span>发布于 {ABSOLUTE_DATE_FORMATTER.format(article.time)}</span>
        <span>最近更新 {formatRelativeTime(article.updatedAt)}</span>
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
