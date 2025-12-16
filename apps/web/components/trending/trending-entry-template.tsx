import Link from "next/link";

import { ABSOLUTE_DATE_FORMATTER, formatRelativeTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import UserInlineLink, {
  type UserBasicInfo,
} from "@/components/user/user-inline-link";

import MetaItem, { type MetaItemProps } from "../meta/meta-item";
import { Badge } from "../ui/badge";

type EntryType = "article" | "discuss";

const TYPE_META: Record<EntryType, { label: string; badgeClass: string }> = {
  article: {
    label: "文章",
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  },
  discuss: {
    label: "讨论",
    badgeClass: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  },
};

export default function TrendingEntryTemplate({
  type,
  time,
  metaTags = [],
  metaText,
  title,
  content,
  contentMaxLines,
  tags,
  metrics,
  user,
  href,
}: {
  type: EntryType;
  time: Date;
  metaTags?: React.ReactNode[] | null;
  metaText?: string | null;
  title?: string | null;
  content?: React.ReactNode | null;
  contentMaxLines?: number;
  tags?: React.ReactNode[] | null;
  metrics?: Omit<MetaItemProps, "compact">[] | null;
  user?: UserBasicInfo | null;
  href?: string | null;
}) {
  return (
    <article>
      <div
        className={cn(
          "group relative flex flex-col rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm transition duration-200 hover:shadow-lg",
          { "hover:-translate-y-1": href },
        )}
      >
        {href && (
          <Link
            href={href}
            className="absolute inset-0 rounded-2xl"
            scroll={false}
            prefetch={false}
          />
        )}
        <div className={cn("z-1", { "pointer-events-none": href })}>
          <header className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                  TYPE_META[type].badgeClass,
                )}
              >
                {TYPE_META[type].label}
              </span>
              {metaTags?.length || metaText ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {metaTags?.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center rounded-full bg-muted/70 px-2.5 py-1 text-xs text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                  {metaText && (
                    <span className="text-muted-foreground/70">{metaText}</span>
                  )}
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <time
                className="text-xs text-muted-foreground"
                dateTime={time.toISOString()}
              >
                {ABSOLUTE_DATE_FORMATTER.format(time)}
              </time>
              <time
                className="text-xs text-muted-foreground"
                dateTime={time.toISOString()}
              >
                {formatRelativeTime(time)}
              </time>
            </div>
          </header>
          <div className="mt-4 space-y-3">
            <h3 className="text-lg leading-tight font-semibold text-foreground">
              {title}
            </h3>
            <div
              className="fake-p my-2 text-base"
              style={{
                overflow: "hidden",
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: contentMaxLines,
                lineClamp: contentMaxLines,
                textAutospace: "normal",
              }}
            >
              {content}
            </div>
            {tags?.length ? (
              <div className="flex flex-wrap items-center gap-2">
                {tags.map((tag, index) => (
                  <Badge
                    key={index}
                    className="bg-muted/70 !px-2 !py-0.5 text-muted-foreground"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
          <footer className="mt-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs text-muted-foreground">
            {user ? (
              <UserInlineLink user={user} avatar />
            ) : (
              <span className="text-foreground">匿名用户</span>
            )}
            <div>
              {metrics?.length ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {metrics.map((metric, index) => (
                    <MetaItem key={index} compact {...metric} />
                  ))}
                </div>
              ) : null}
            </div>
          </footer>
        </div>
      </div>
    </article>
  );
}
