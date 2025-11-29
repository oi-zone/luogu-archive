import * as React from "react";
import { Eye, MessageSquare } from "lucide-react";
import Link from "next/link";

import { getContentHref } from "@/lib/content-links";
import {
  ABSOLUTE_DATE_FORMATTER,
  formatRelativeTime,
  TYPE_BADGE_CLASS,
  TYPE_LABEL,
  type FeedItem,
} from "@/lib/feed-data";
import { cn } from "@/lib/utils";
import { UserInlineLink } from "@/components/user/user-inline-link";

function FeedCard({ item }: { item: FeedItem }) {
  const href = getContentHref(item);

  const content = (
    <div className="group relative mb-6 flex flex-col rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
            TYPE_BADGE_CLASS[item.type],
          )}
        >
          {TYPE_LABEL[item.type]}
        </span>
        <time
          className="text-xs text-muted-foreground"
          dateTime={item.publishedAt.toISOString()}
        >
          {formatRelativeTime(item.publishedAt)}
        </time>
      </div>

      {item.type !== "status" ? (
        <div className="mt-4 space-y-3">
          <h3 className="text-lg leading-tight font-semibold">{item.title}</h3>
          <div className="space-y-1.5">
            <span className="text-xs tracking-wide text-muted-foreground/70 uppercase">
              {item.type === "article" ? "摘要" : "内容梗概"}
            </span>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {item.summary}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          {item.content}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
        <UserInlineLink
          user={item.author}
          className="text-foreground/90 hover:text-foreground"
        />
        {item.type !== "status" && (
          <>
            <span className="flex items-center gap-1">
              <MessageSquare className="size-3.5 text-muted-foreground" />
              {item.replies}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="size-3.5 text-muted-foreground" />
              {item.views.toLocaleString("zh-CN")}
            </span>
          </>
        )}
        <time
          className="text-muted-foreground/80"
          dateTime={item.publishedAt.toISOString()}
        >
          {ABSOLUTE_DATE_FORMATTER.format(item.publishedAt)}
        </time>
      </div>
    </div>
  );

  if (!href) {
    return <article className="break-inside-avoid">{content}</article>;
  }

  return (
    <article className="break-inside-avoid">
      <Link href={href} className="block" scroll={false}>
        {content}
      </Link>
    </article>
  );
}
