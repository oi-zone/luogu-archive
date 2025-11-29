import Link from "next/link";

import type { FeedEntry } from "@/lib/feed-client";
import { ABSOLUTE_DATE_FORMATTER, formatRelativeTime } from "@/lib/feed-data";
import { cn } from "@/lib/utils";
import UserInlineLink, {
  type UserBasicInfo,
} from "@/components/user/user-inline-link";

const TYPE_META: Record<
  FeedEntry["type"],
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
    label: "社区裁决",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  },
};

export function FeedCard({ item }: { item: FeedEntry }) {
  const timestamp = getEntryTimestamp(item);
  const badge = TYPE_META[item.type];
  const card = (
    <div className="group relative mb-6 flex flex-col rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg">
      <header className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
            badge.badgeClass,
          )}
        >
          {badge.label}
        </span>
        <time
          className="text-xs text-muted-foreground"
          dateTime={timestamp.toISOString()}
        >
          {formatRelativeTime(timestamp)}
        </time>
      </header>

      {renderBody(item)}

      <footer className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
        {renderUser(item)}
        <time
          className="text-muted-foreground/80"
          dateTime={timestamp.toISOString()}
        >
          {ABSOLUTE_DATE_FORMATTER.format(timestamp)}
        </time>
      </footer>
    </div>
  );

  if (!item.href) {
    return <article className="break-inside-avoid">{card}</article>;
  }

  return (
    <article className="break-inside-avoid">
      <Link href={item.href} className="block" scroll={false}>
        {card}
      </Link>
    </article>
  );
}

function renderBody(item: FeedEntry) {
  switch (item.type) {
    case "article":
      return (
        <div className="mt-4 space-y-3">
          <h3 className="text-lg leading-tight font-semibold text-foreground">
            {item.title}
          </h3>
          <dl className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <div className="flex flex-col rounded-xl bg-muted/40 px-3 py-2">
              <dt className="text-[0.7rem] tracking-wide uppercase">总回复</dt>
              <dd className="text-base font-semibold text-foreground">
                {item.replyCount}
              </dd>
            </div>
            <div className="flex flex-col rounded-xl bg-muted/40 px-3 py-2">
              <dt className="text-[0.7rem] tracking-wide uppercase">
                近期回复
              </dt>
              <dd className="text-base font-semibold text-foreground">
                {item.recentReplyCount}
              </dd>
            </div>
            <div className="flex flex-col rounded-xl bg-muted/40 px-3 py-2">
              <dt className="text-[0.7rem] tracking-wide uppercase">收藏</dt>
              <dd className="text-base font-semibold text-foreground">
                {item.favorCount}
              </dd>
            </div>
            <div className="flex flex-col rounded-xl bg-muted/40 px-3 py-2">
              <dt className="text-[0.7rem] tracking-wide uppercase">赞同</dt>
              <dd className="text-base font-semibold text-foreground">
                {item.upvote}
              </dd>
            </div>
          </dl>
        </div>
      );
    case "discussion":
      return (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-muted/70 px-2 py-0.5 text-muted-foreground">
              {item.forum}
            </span>
            <span className="text-muted-foreground/70">讨论热度</span>
          </div>
          <h3 className="text-lg leading-tight font-semibold text-foreground">
            {item.title}
          </h3>
          <dl className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <div className="flex flex-col rounded-xl bg-muted/40 px-3 py-2">
              <dt className="text-[0.7rem] tracking-wide uppercase">总回复</dt>
              <dd className="text-base font-semibold text-foreground">
                {item.replyCount}
              </dd>
            </div>
            <div className="flex flex-col rounded-xl bg-muted/40 px-3 py-2">
              <dt className="text-[0.7rem] tracking-wide uppercase">
                近期回复
              </dt>
              <dd className="text-base font-semibold text-foreground">
                {item.recentReplyCount}
              </dd>
            </div>
          </dl>
        </div>
      );
    case "paste":
      return (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
            <span className="rounded-full bg-muted/70 px-2 py-0.5 text-muted-foreground">
              {item.isAuthorPrivileged ? "官方分享" : "云剪贴板"}
            </span>
            <span>{item.title}</span>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {item.preview}
          </p>
        </div>
      );
    case "judgement":
      return (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold text-foreground">{item.action}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {item.reason?.trim() || "暂无描述"}
          </p>
        </div>
      );
    default:
      return null;
  }
}

function renderUser(item: FeedEntry) {
  const user = getEntryUser(item);
  if (!user) {
    return <span className="text-xs text-muted-foreground/70">匿名用户</span>;
  }
  return (
    <UserInlineLink
      user={user}
      className="text-foreground/90 hover:text-foreground"
      avatar
    />
  );
}

function getEntryTimestamp(item: FeedEntry) {
  switch (item.type) {
    case "article":
      return new Date(item.publishedAt);
    case "discussion":
      return new Date(item.updatedAt);
    case "paste":
      return new Date(item.createdAt);
    case "judgement":
      return new Date(item.createdAt);
    default:
      return new Date();
  }
}

function getEntryUser(item: FeedEntry): UserBasicInfo | null {
  switch (item.type) {
    case "article":
    case "discussion":
    case "paste":
      return item.author;
    case "judgement":
      return item.user;
    default:
      return null;
  }
}
