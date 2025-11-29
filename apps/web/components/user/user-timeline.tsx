import {
  ClipboardList,
  FileText,
  Gavel,
  Layers,
  MessageCircle,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { formatRelativeTime } from "@/lib/feed-data";
import type { TimelineEntry } from "@/lib/user-profile-shared";
import { cn } from "@/lib/utils";

const TIMELINE_META: Record<
  TimelineEntry["type"],
  {
    label: string;
    icon: LucideIcon;
    badgeClass: string;
    dotClass: string;
  }
> = {
  article: {
    label: "发布文章",
    icon: FileText,
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
    dotClass: "bg-sky-500",
  },
  discussion: {
    label: "发起讨论",
    icon: Layers,
    badgeClass: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    dotClass: "bg-violet-500",
  },
  articleComment: {
    label: "评论文章",
    icon: MessageSquare,
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
  },
  discussionReply: {
    label: "回复讨论",
    icon: MessageCircle,
    badgeClass: "bg-orange-500/10 text-orange-600 dark:text-orange-300",
    dotClass: "bg-orange-500",
  },
  paste: {
    label: "创建云剪贴板",
    icon: ClipboardList,
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    dotClass: "bg-amber-500",
  },
  judgement: {
    label: "社区裁决",
    icon: Gavel,
    badgeClass: "bg-red-500/10 text-red-600 dark:text-red-300",
    dotClass: "bg-red-500",
  },
};

const VISIBILITY_LABEL: Record<
  Extract<TimelineEntry, { type: "paste" }>["visibility"],
  string
> = {
  public: "公开",
  team: "团队可见",
  private: "仅自己",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function UserTimeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <section>
      <header className="mb-6">
        <h3 className="text-lg font-semibold">时间线</h3>
        <p className="text-sm text-muted-foreground">
          最近的文章、讨论、云剪贴板与社区记录
        </p>
      </header>
      <ol className="space-y-6 border-l border-border/80 pl-6">
        {entries.map((entry) => {
          const meta = TIMELINE_META[entry.type];
          const createdAt = new Date(entry.createdAt);
          const relative = formatRelativeTime(createdAt);
          const Icon = meta.icon;

          return (
            <li key={entry.id} className="relative">
              <span
                aria-hidden
                className={cn(
                  "absolute top-2 -left-[15px] inline-flex size-3 items-center justify-center rounded-full border-2 border-card",
                  meta.dotClass,
                )}
              />
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                    meta.badgeClass,
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {meta.label}
                </span>
                <time
                  className="text-xs text-muted-foreground"
                  dateTime={entry.createdAt}
                >
                  {DATE_FORMATTER.format(createdAt)} · {relative}
                </time>
              </div>
              <div className="mt-3 space-y-3">
                {renderTimelineContent(entry)}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function renderTimelineContent(entry: TimelineEntry) {
  switch (entry.type) {
    case "article":
      return (
        <div className="rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm">
          <Link
            href={entry.href}
            className="text-base font-semibold text-foreground hover:underline"
          >
            {entry.title}
          </Link>
          <p className="mt-2 text-muted-foreground">{entry.summary}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>获赞 {entry.reactions}</span>
            <span>评论 {entry.comments}</span>
          </div>
        </div>
      );
    case "discussion":
      return (
        <div className="rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm">
          <Link
            href={entry.href}
            className="text-base font-semibold text-foreground hover:underline"
          >
            {entry.title}
          </Link>
          <p className="mt-2 text-muted-foreground">{entry.summary}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>回复 {entry.replies}</span>
            <span>参与人数 {entry.participants}</span>
          </div>
        </div>
      );
    case "articleComment":
      return (
        <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm">
          <p className="text-muted-foreground">
            在文章
            <Link
              href={entry.href}
              className="mx-1 font-medium text-foreground hover:underline"
            >
              《{entry.articleTitle}》
            </Link>
            发表评论：
          </p>
          <blockquote className="mt-2 border-l-2 border-primary/40 pl-3 text-muted-foreground">
            {entry.excerpt}
          </blockquote>
        </div>
      );
    case "discussionReply":
      return (
        <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm">
          <p className="text-muted-foreground">
            在讨论
            <Link
              href={entry.href}
              className="mx-1 font-medium text-foreground hover:underline"
            >
              《{entry.discussionTitle}》
            </Link>
            回复：
          </p>
          <blockquote className="mt-2 border-l-2 border-primary/40 pl-3 text-muted-foreground">
            {entry.excerpt}
          </blockquote>
        </div>
      );
    case "paste":
      return (
        <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm">
          <Link
            href={entry.href}
            className="text-base font-semibold text-foreground hover:underline"
          >
            {entry.title}
          </Link>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            {entry.description}
          </p>
          <div className="mt-3 text-xs text-muted-foreground">
            可见性：{VISIBILITY_LABEL[entry.visibility]}
          </div>
        </div>
      );
    case "judgement":
      return (
        <div className="rounded-2xl border border-red-500/50 bg-red-500/5 p-4 text-sm">
          <p className="font-semibold text-red-600 dark:text-red-300">
            {entry.action}
          </p>
          <p className="mt-1 text-red-600/80 dark:text-red-200/80">
            {entry.reason}
          </p>
        </div>
      );
    default:
      return null;
  }
}
