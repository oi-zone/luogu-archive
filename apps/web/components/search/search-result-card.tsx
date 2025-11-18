import Link from "next/link";

import { getContentHref } from "@/lib/content-links";
import {
  ABSOLUTE_DATE_FORMATTER,
  formatRelativeTime,
  TYPE_BADGE_CLASS,
  TYPE_LABEL,
} from "@/lib/feed-data";
import { getCategoryMeta, type SearchResult } from "@/lib/search-data";
import { cn } from "@/lib/utils";
import UserInlineLink from "@/components/user/user-inline-link";

export function SearchResultCard({ result }: { result: SearchResult }) {
  const categoryMeta = getCategoryMeta(result.category);

  const heading =
    result.type === "status" ? `${result.author.name} 的动态` : result.title;

  const description =
    result.type === "status" ? result.content : result.summary;

  const href = getContentHref(result);

  const card = (
    <article className="bg-card border-border text-card-foreground group relative overflow-hidden rounded-3xl border p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {categoryMeta && (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
                categoryMeta.badgeClass,
              )}
            >
              {categoryMeta.label}
            </span>
          )}
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
              TYPE_BADGE_CLASS[result.type],
            )}
          >
            {TYPE_LABEL[result.type]}
          </span>
        </div>
        <time
          className="text-muted-foreground text-xs"
          dateTime={result.publishedAt.toISOString()}
        >
          {formatRelativeTime(result.publishedAt)}
        </time>
      </div>

      <div className="mt-4 space-y-3">
        <h3 className="text-foreground text-xl font-semibold leading-tight">
          {heading}
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {description}
        </p>
      </div>

      <div className="text-muted-foreground mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <UserInlineLink user={result.author} />
        {result.type !== "status" &&
          "replies" in result &&
          "views" in result && (
            <>
              <span>回复 {result.replies}</span>
              <span>阅读 {result.views.toLocaleString("zh-CN")}</span>
            </>
          )}
        <time
          className="text-muted-foreground/80"
          dateTime={result.publishedAt.toISOString()}
        >
          {ABSOLUTE_DATE_FORMATTER.format(result.publishedAt)}
        </time>
      </div>
    </article>
  );

  return href ? (
    <Link href={href} className="block" scroll={false}>
      {card}
    </Link>
  ) : (
    card
  );
}
