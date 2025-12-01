import Link from "next/link";

import type { FeedEntry } from "@luogu-discussion-archive/query";

import { formatRelativeTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import UserInlineLink, {
  type UserBasicInfo,
} from "@/components/user/user-inline-link";

import MetaItem, { type MetaItemProps } from "../meta/meta-item";
import { Badge } from "../ui/badge";

const TYPE_META: Record<
  FeedEntry["kind"],
  { label: string; badgeClass: string }
> = {
  article: {
    label: "文章",
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  },
  discussion: {
    label: "讨论",
    badgeClass: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  },
  paste: {
    label: "云剪贴板",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  },
  judgement: {
    label: "陶片放逐",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  },
};

export default function FeedCardTemplate({
  kind,
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
  kind: FeedEntry["kind"];
  time: Date;
  metaTags?: string[] | null;
  metaText?: string | null;
  title?: string | null;
  content?: React.ReactNode | null;
  contentMaxLines?: number;
  tags?: string[] | null;
  metrics?: Omit<MetaItemProps, "compact">[] | null;
  user?: UserBasicInfo | null;
  href?: string | null;
}) {
  return (
    <article>
      <div className="group relative flex flex-col rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg">
        {href && (
          <Link
            href={href}
            className="absolute inset-0"
            scroll={false}
            prefetch={false}
          />
        )}
        <div className="pointer-events-none z-1">
          <header className="flex items-center justify-between gap-3">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                TYPE_META[kind].badgeClass,
              )}
            >
              {TYPE_META[kind].label}
            </span>
          </header>
          <div className="mt-4 space-y-3">
            {metaTags?.length || metaText ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {metaTags?.map((tag, index) => (
                  <Badge
                    key={index}
                    className="bg-muted/70 !px-2 !py-0.5 text-muted-foreground"
                  >
                    {tag}
                  </Badge>
                ))}
                {metaText && (
                  <span className="text-muted-foreground/70">{metaText}</span>
                )}
              </div>
            ) : null}
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
            {metrics?.length ? (
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
                {metrics.map((metric, index) => (
                  <MetaItem key={index} compact {...metric} />
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
            <time
              className="text-xs text-muted-foreground"
              dateTime={time.toISOString()}
            >
              {formatRelativeTime(time)}
            </time>
          </footer>
        </div>
      </div>
    </article>
  );
}
