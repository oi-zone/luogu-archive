"use client";

import * as React from "react";
import { Eye, Loader2, MessageSquare } from "lucide-react";
import Link from "next/link";

import { getContentHref } from "@/lib/content-links";
import {
  ABSOLUTE_DATE_FORMATTER,
  formatRelativeTime,
  generateFeedItem,
  TYPE_BADGE_CLASS,
  TYPE_LABEL,
  type FeedItem,
} from "@/lib/feed-data";
import { cn } from "@/lib/utils";
import UserInlineLink from "@/components/user/user-inline-link";

const BATCH_SIZE = 18;

export default function Page() {
  const [items, setItems] = React.useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  const loadingTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const loadMore = React.useCallback(() => {
    if (loadingTimeoutRef.current !== null) {
      return;
    }
    setIsLoading(true);
    setItems((prev) => {
      const next = [...prev];
      for (let index = 0; index < BATCH_SIZE; index += 1) {
        next.push(generateFeedItem());
      }
      return next;
    });
    loadingTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      loadingTimeoutRef.current = null;
    }, 220);
  }, []);

  React.useEffect(() => {
    loadMore();
  }, [loadMore]);

  React.useEffect(() => {
    const node = sentinelRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "600px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  React.useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current !== null) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-8 px-6 pb-12 pt-8">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">社区精选</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              实时更新的文章、讨论与动态，跟进社区的每一次灵感。
            </p>
          </div>
        </div>
      </div>
      <div className="columns-1 gap-6 [column-fill:_balance] sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5">
        {items.map((item) => (
          <FeedCard key={item.id} item={item} />
        ))}
      </div>
      <div ref={sentinelRef} className="flex justify-center py-6">
        {isLoading && (
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        )}
      </div>
    </div>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  const href = getContentHref(item);

  const content = (
    <div className="bg-card border-border text-card-foreground group relative mb-6 flex flex-col rounded-2xl border p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg">
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
          className="text-muted-foreground text-xs"
          dateTime={item.publishedAt.toISOString()}
        >
          {formatRelativeTime(item.publishedAt)}
        </time>
      </div>

      {item.type !== "status" ? (
        <div className="mt-4 space-y-3">
          <h3 className="text-lg font-semibold leading-tight">{item.title}</h3>
          <div className="space-y-1.5">
            <span className="text-muted-foreground/70 text-xs uppercase tracking-wide">
              {item.type === "article" ? "摘要" : "内容梗概"}
            </span>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {item.summary}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground mt-4 text-base leading-relaxed">
          {item.content}
        </p>
      )}

      <div className="text-muted-foreground mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
        <UserInlineLink user={item.author} />
        {item.type !== "status" && (
          <>
            <span className="flex items-center gap-1">
              <MessageSquare className="text-muted-foreground size-3.5" />
              {item.replies}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="text-muted-foreground size-3.5" />
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
