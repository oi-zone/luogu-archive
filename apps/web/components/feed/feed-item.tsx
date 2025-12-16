import {
  CalendarClock,
  MessageCircle,
  MessageSquare,
  Star,
  ThumbsUp,
} from "lucide-react";

import type { FeedEntry } from "@luogu-discussion-archive/query";

import { getCategoryInfo } from "@/lib/category-info";
import { getPermissionNames } from "@/lib/judgement";
import { renderMarkdownToPlainText } from "@/lib/markdown-plain-text";

import { ForumDisplayShort } from "../forum/forum-display";
import FeedCardTemplate from "./feed-card-template";

export function FeedCard({
  item,
  headless,
  tabIndexOverride,
}: {
  item: FeedEntry;
  headless?: boolean;
  tabIndexOverride?: number;
}) {
  const timestamp = getEntryTimestamp(item);

  switch (item.kind) {
    case "article": {
      const categoryName =
        typeof item.category === "number"
          ? getCategoryInfo(item.category).name
          : null;
      const rawContent = item.content?.trim() || "";
      const plainContent =
        rawContent.length > 0 ? renderMarkdownToPlainText(rawContent) : "";
      const summary = item.summary?.trim() || "";
      return (
        <FeedCardTemplate
          href={resolveLink(item)}
          kind={item.kind}
          time={timestamp}
          metaTags={categoryName ? [categoryName] : undefined}
          title={item.title}
          content={summary || plainContent}
          contentMaxLines={summary ? undefined : 4}
          tags={item.tags?.length ? item.tags : undefined}
          metrics={[
            { icon: MessageCircle, children: `${item.replyCount}\u2009评论` },
            {
              icon: CalendarClock,
              children: `最近\u2009${item.recentReplyCount}\u2009评论`,
            },
            { icon: Star, children: `${item.favorCount}\u2009收藏` },
            { icon: ThumbsUp, children: `${item.upvote}\u2009赞同` },
          ]}
          user={item.author}
          headless={headless}
          tabIndexOverride={tabIndexOverride}
        />
      );
    }
    case "discussion": {
      const rawContent = item.content?.trim() || "";
      const plainContent =
        rawContent.length > 0 ? renderMarkdownToPlainText(rawContent) : "";
      return (
        <FeedCardTemplate
          href={resolveLink(item)}
          kind={item.kind}
          time={timestamp}
          metaTags={[
            <ForumDisplayShort forum={item.forum} key={item.forum.slug} />,
          ]}
          title={item.title}
          content={plainContent}
          contentMaxLines={4}
          metrics={[
            { icon: MessageSquare, children: `${item.replyCount}\u2009回复` },
            {
              icon: CalendarClock,
              children: `最近\u2009${item.recentReplyCount}\u2009回复`,
            },
          ]}
          user={item.author}
          headless={headless}
          tabIndexOverride={tabIndexOverride}
        />
      );
    }
    case "paste":
      return (
        <FeedCardTemplate
          href={resolveLink(item)}
          kind={item.kind}
          time={timestamp}
          title={item.title}
          content={item.preview}
          contentMaxLines={7}
          user={item.author}
          headless={headless}
          tabIndexOverride={tabIndexOverride}
        />
      );
    case "judgement":
      return (
        <FeedCardTemplate
          kind={item.kind}
          time={timestamp}
          content={
            <>
              {item.addedPermission || item.revokedPermission ? (
                <div className="text-base font-semibold">
                  <ul>
                    {getPermissionNames(item.addedPermission).map((name) => (
                      <li key={name}>
                        授予 <code>{name}</code> 权限
                      </li>
                    ))}
                    {getPermissionNames(item.revokedPermission).map((name) => (
                      <li key={name}>
                        撤销 <code>{name}</code> 权限
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="mt-1">
                {item.reason?.trim() || "没道理，就这样。"}
              </div>
            </>
          }
          contentMaxLines={6}
          user={item.author}
          headless={headless}
          tabIndexOverride={tabIndexOverride}
        />
      );
    default:
      return null;
  }
}

function getEntryTimestamp(item: FeedEntry) {
  switch (item.kind) {
    case "article":
      return new Date(item.timestamp);
    case "discussion":
      return new Date(item.timestamp);
    case "paste":
      return new Date(item.timestamp);
    case "judgement":
      return new Date(item.timestamp);
    default:
      return new Date();
  }
}

function resolveLink(item: FeedEntry) {
  switch (item.kind) {
    case "article":
      return `/a/${item.articleId}`;
    case "discussion":
      return `/d/${item.postId}`;
    case "paste":
      return `/p/${item.pasteId}`;
    case "judgement":
      return `/judgement`;
    default:
      return null;
  }
}
