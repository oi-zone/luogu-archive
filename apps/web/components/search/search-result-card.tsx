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
    <article className="group relative overflow-hidden rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
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
          className="text-xs text-muted-foreground"
          dateTime={result.publishedAt.toISOString()}
        >
          {formatRelativeTime(result.publishedAt)}
        </time>
      </div>

      <div className="mt-4 space-y-3">
        <h3 className="text-xl leading-tight font-semibold text-foreground">
          {heading}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
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
