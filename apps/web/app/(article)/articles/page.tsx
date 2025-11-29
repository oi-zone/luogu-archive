import { Award, Search } from "lucide-react";
import Link from "next/link";

import {
  ARTICLE_SCORE_WEIGHT,
  FEATURED_ARTICLE_DEFAULT_LIMIT,
  FEATURED_ARTICLE_DEFAULT_UPVOTE_DECAY_MS,
  FEATURED_ARTICLE_DEFAULT_WINDOW_MS,
  getFeaturedArticles,
  type FeaturedArticleSummary,
} from "@luogu-discussion-archive/query";

import { ABSOLUTE_DATE_FORMATTER, formatRelativeTime } from "@/lib/feed-data";
import { Badge } from "@/components/ui/badge";
import { MasonryColumns } from "@/components/layout/masonry-columns";
import UserInlineLink from "@/components/user/user-inline-link";

const SCORE_FORMATTER = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatWeight(weight: number) {
  return `${Math.round(weight * 100)}%`;
}

const SCORE_FORMULA_LABEL = `回复 ${formatWeight(ARTICLE_SCORE_WEIGHT.replies)} + 收藏 ${formatWeight(ARTICLE_SCORE_WEIGHT.favorites)} + 赞同 ${formatWeight(ARTICLE_SCORE_WEIGHT.upvotes)}`;
const WINDOW_LABEL = formatWindowLabel(FEATURED_ARTICLE_DEFAULT_WINDOW_MS);
const UPVOTE_DECAY_LABEL = formatWindowLabel(
  FEATURED_ARTICLE_DEFAULT_UPVOTE_DECAY_MS,
);

export default async function ArticlesPage() {
  const articles = await getFeaturedArticles();

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
              依照 {SCORE_FORMULA_LABEL} 的综合得分，实时列出前{" "}
              {FEATURED_ARTICLE_DEFAULT_LIMIT} 篇文章；其中回复指标统计最近{" "}
              {WINDOW_LABEL} 的互动，赞同会按 {UPVOTE_DECAY_LABEL}{" "}
              的时间尺度指数衰减。
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
          {articles.length === 0
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
            暂无数据，等候新文章发布后再试。
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
