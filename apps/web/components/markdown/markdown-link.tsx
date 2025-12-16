"use client";

import * as React from "react";
import luoguSvg from "@/app/luogu.svg";
import { useQuery } from "@tanstack/react-query";
import {
  AtSign,
  CalendarClock,
  ClipboardList,
  FileText,
  MessageCircle,
  MessageSquare,
  MessageSquareReply,
  MessagesSquare,
  Star,
  Swords,
  ThumbsUp,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Entry, EntryRef } from "@luogu-discussion-archive/query";

import { getCategoryInfo } from "@/lib/category-info";
import { cn } from "@/lib/utils";

import FeedCardTemplate from "../feed/feed-card-template";
import { ForumDisplayShort } from "../forum/forum-display";
import UserInlineLink from "../user/user-inline-link";
import {
  articleRegexes,
  captureFromFirstMatch,
  discussionRegexes,
  pasteRegexes,
  problemRegexes,
  userRegexes,
} from "./link";
import { entryLoader } from "./magic-link/entry-loader";
import LinkWithOriginal from "./magic-link/link-with-original";
import UserMagicLinkDirect from "./magic-link/user/direct";
import UserMagicLinkWithOriginal from "./magic-link/user/with-original";
import type { MarkdownMentionContext } from "./markdown";
import { MentionReplyOverlayTrigger } from "./mention-reply-overlay";

const ZERO_WIDTH_REGEX = /[\u200b\u200c\u200d\u2060\ufeff]/g;
const URL_LIKE_PATTERN = /^(https?:\/\/|www\.|[a-z0-9.-]+\.[a-z]{2,})(?:\/|$)/i;

type ElementWithChildren = React.ReactElement<{ children?: React.ReactNode }>;

function extractTextFromChildren(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }
      if (React.isValidElement(child)) {
        return extractTextFromChildren(
          (child as ElementWithChildren).props.children,
        );
      }
      return "";
    })
    .join("")
    .trim();
}

function onlyHasImageChildren(children: React.ReactNode): boolean {
  return React.Children.toArray(children).every((child) => {
    if (React.isValidElement(child)) {
      const element = child as ElementWithChildren;
      if (element.type === "img") {
        return true;
      }
      if (element.props.children) {
        return onlyHasImageChildren(element.props.children);
      }
      return false;
    }
    return false;
  });
}

function extractLabelFromSource(source?: string) {
  if (!source) return "";
  const match = source.match(/\[([\s\S]*?)\]/);
  return match ? match[1] : "";
}

function cleanPlainText(value?: string | null) {
  if (!value) return "";
  return value.replace(ZERO_WIDTH_REGEX, "").replace(/\s+/g, " ").trim();
}

function normalizePlainText(value?: string | null) {
  return cleanPlainText(value).toLowerCase();
}

function looksLikeUrl(label: string) {
  return URL_LIKE_PATTERN.test(label.trim());
}

function normalizeUrlComparable(value?: string | null) {
  if (!value) return "";
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

function normalizeHrefComparable(href: string) {
  if (!href) return "";
  try {
    const parsed = new URL(href);
    const host = parsed.host.replace(/^www\./i, "");
    const path = parsed.pathname.replace(/\/$/, "");
    return `${host}${path}${parsed.search}${parsed.hash}`.toLowerCase();
  } catch {
    return normalizeUrlComparable(href);
  }
}

type UsefulnessContext = {
  href: string;
  text?: string;
  rawSource?: string;
  kind: "discussion" | "article" | "paste" | "user" | "problem";
  referenceId?: string;
  referenceName?: string;
  referenceTitle?: string;
};

function escapeBackslash(value: string) {
  let result = "";
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === "\\") {
      i++;
      if (i < value.length) {
        result += value[i];
      }
    } else {
      result += char;
    }
  }
  return result;
}

function isLinkTextUseful({
  href,
  text,
  rawSource,
  kind,
  referenceId,
  referenceName,
  referenceTitle,
}: UsefulnessContext) {
  const labelRaw = escapeBackslash(extractLabelFromSource(rawSource));
  const label = cleanPlainText(text) || cleanPlainText(labelRaw);
  if (!label) return false;

  const normalizedHref = normalizeHrefComparable(href);
  if (normalizedHref && looksLikeUrl(label)) {
    const normalizedLabel = normalizeUrlComparable(label);
    if (normalizedLabel === normalizedHref) {
      return false;
    }
  }

  if (kind === "user" && referenceName) {
    if (
      [referenceName.toLowerCase(), `@${referenceName.toLowerCase()}`].includes(
        labelRaw?.trim().toLowerCase() ?? "",
      )
    ) {
      return false;
    }
    if (
      [referenceName.toLowerCase(), `@${referenceName.toLowerCase()}`].includes(
        text?.trim().toLowerCase() ?? "",
      )
    ) {
      return false;
    }
  }

  if (kind === "user" && referenceId) {
    if ([referenceId, `@${referenceId}`].includes(labelRaw?.trim() ?? "")) {
      return false;
    }
    if ([referenceId, `@${referenceId}`].includes(text?.trim() ?? "")) {
      return false;
    }
    if (captureFromFirstMatch(userRegexes, label)?.[1] ?? "" === referenceId) {
      return false;
    }
  }

  if (
    (kind === "discussion" || kind === "article" || kind === "problem") &&
    referenceTitle
  ) {
    const normalizedLabel = normalizePlainText(label);
    const normalizedTitle = normalizePlainText(referenceTitle);
    if (
      normalizedLabel &&
      normalizedTitle &&
      normalizedLabel === normalizedTitle
    ) {
      return false;
    }
  }

  if (kind === "discussion" && referenceId) {
    if (
      captureFromFirstMatch(discussionRegexes, label)?.[1] ??
      "" === referenceId
    ) {
      return false;
    }
  }

  if (kind === "article" && referenceId) {
    if (
      captureFromFirstMatch(articleRegexes, label)?.[1] ??
      "" === referenceId
    ) {
      return false;
    }
  }

  if (kind === "paste" && referenceId) {
    if (captureFromFirstMatch(pasteRegexes, label)?.[1] ?? "" === referenceId) {
      return false;
    }
  }

  if (kind === "problem" && referenceId) {
    if (
      captureFromFirstMatch(problemRegexes, label)?.[1] ??
      "" === referenceId
    ) {
      return false;
    }
  }

  return true;
}

type MarkdownLinkProps = React.ComponentProps<"a"> & {
  originalUrl?: string;
  "data-ls-user-mention"?: string;
  "data-ls-discuss"?: string;
  "data-ls-article"?: string;
  "data-ls-user"?: string;
  "data-ls-paste"?: string;
  "data-ls-problem"?: string;
  "data-ls-link-text"?: string;
  "data-ls-link-source"?: string;
  mentionContext?: MarkdownMentionContext;
};

export default function MarkdownLink(props: MarkdownLinkProps) {
  const { href, children, className, originalUrl, mentionContext, ...rest } =
    props;

  const pluginLinkText = props["data-ls-link-text"];
  const linkTextSource = props["data-ls-link-source"];

  const markdownLabel = React.useMemo(() => {
    const sourceLabel = extractLabelFromSource(linkTextSource);
    if (sourceLabel?.trim()) {
      return sourceLabel;
    }
    if (pluginLinkText?.trim()) {
      return pluginLinkText;
    }
    return "";
  }, [linkTextSource, pluginLinkText]);

  const linkLabel = React.useMemo(() => {
    if (markdownLabel) {
      return markdownLabel;
    }
    return extractTextFromChildren(children);
  }, [children, markdownLabel]);

  const isBlankLink = href === null || href === undefined || href.trim() === "";

  const trueUrl = isBlankLink
    ? "#"
    : new URL(
        href ?? "",
        originalUrl ?? "https://www.luogu.com.cn/",
      ).toString();

  const ref: EntryRef | null = props["data-ls-discuss"]
    ? { type: "discuss", id: props["data-ls-discuss"] }
    : props["data-ls-article"]
      ? { type: "article", id: props["data-ls-article"] }
      : (props["data-ls-user"] ?? props["data-ls-user-mention"])
        ? {
            type: "user",
            id: props["data-ls-user"] ?? props["data-ls-user-mention"]!,
          }
        : props["data-ls-paste"]
          ? { type: "paste", id: props["data-ls-paste"] }
          : props["data-ls-problem"]
            ? { type: "problem", id: props["data-ls-problem"] }
            : null;

  const { data: entry } = useQuery<Entry>({
    queryKey: [ref?.type, ref?.id],
    queryFn: () => entryLoader.load(ref!),
    enabled: ref !== null,
  });

  const onlyImagesInChildren = onlyHasImageChildren(children);

  if (props["data-ls-user-mention"]) {
    if (entry && entry.type === "user" && entry.data) {
      const shouldEnableInference =
        mentionContext?.kind === "discussion" &&
        mentionContext.discussionId !== undefined &&
        mentionContext.relativeReplyId !== undefined;

      return (
        <span className="ls-user-mention inline-flex items-center">
          <AtSign
            className={cn(
              "relative top-0.5 inline-block size-4 stroke-[1.5] text-muted-foreground",
              // `text-luogu-${userInfo.color.toLowerCase()}`,
            )}
          />
          <span className="relative top-1 -ms-0.75 -mt-1 inline-flex items-center gap-0">
            <UserInlineLink
              user={{ ...entry.data, id: entry.data.uid }}
              compact
              avatar={false}
            />
            {shouldEnableInference && (
              <MentionReplyOverlayTrigger
                discussionId={mentionContext.discussionId}
                mentionUserId={entry.data.uid}
                relativeReplyId={mentionContext.relativeReplyId}
                className="me-1 inline-flex cursor-pointer items-center gap-0.75 rounded-full bg-background/50 px-1.75 py-1.25 shadow-sm ring-1 ring-border backdrop-blur-xs transition duration-200 select-none hover:-translate-y-0.25 hover:shadow"
                isFromDiscussionAuthor={mentionContext.discussionAuthors.includes(
                  entry.data.uid,
                )}
              >
                <MessageSquareReply className="inline-block size-3 stroke-2" />
                <span className="inline-block text-xs leading-none">
                  回复推断
                </span>
              </MentionReplyOverlayTrigger>
            )}
          </span>
        </span>
      );
    }

    return (
      <span className="ls-user-mention inline-flex items-center gap-0.25">
        <AtSign
          className={cn("relative top-0.5 inline-block size-4 stroke-[1.75]")}
        />
        <span className="relative top-1 ms-0.25 me-0.75 -mt-1 inline-flex items-center gap-0 text-muted-foreground">
          {children ?? linkLabel}
        </span>
      </span>
    );
  }

  if (!isBlankLink) {
    if (entry?.type === "discuss") {
      if (entry.data) {
        const display = isLinkTextUseful({
          href: trueUrl,
          text: linkLabel,
          rawSource: linkTextSource,
          kind: "discussion",
          referenceTitle: entry.data.title,
          referenceId: entry.id,
        })
          ? (children ?? (linkLabel || `讨论\u2009${entry.id}`))
          : entry.data.title;

        return (
          <LinkWithOriginal
            href={`/d/${entry.id}`}
            Icon={MessagesSquare}
            iconCorner={onlyImagesInChildren}
            original={display}
            preview={
              <FeedCardTemplate
                headless
                kind="discussion"
                time={new Date(entry.data.time * 1000)}
                metaTags={[
                  <ForumDisplayShort
                    forum={entry.data.forum}
                    key={entry.data.forum.slug}
                  />,
                ]}
                title={entry.data.title}
                metrics={[
                  {
                    icon: MessageSquare,
                    children: `${entry.data.replyCount}\u2009回复`,
                  },
                ]}
                user={{ ...entry.data.author, id: entry.data.author.uid }}
              />
            }
          />
        );
      }

      return (
        <Link href={`/d/${entry.id}`} className={className} {...rest}>
          <MessagesSquare
            className="relative top-[0.03125em] me-0.5 -mt-[0.25em] inline-block size-[1em]"
            aria-hidden="true"
          />
          {children ?? (linkLabel || `讨论\u2009${entry.id}`)}
        </Link>
      );
    }

    if (entry?.type === "article") {
      if (entry.data) {
        const display = isLinkTextUseful({
          href: trueUrl,
          text: linkLabel,
          rawSource: linkTextSource,
          kind: "article",
          referenceTitle: entry.data.title,
          referenceId: entry.id,
        })
          ? (children ?? (linkLabel || `文章\u2009${entry.id}`))
          : entry.data.title;

        const categoryName =
          typeof entry.data.category === "number"
            ? getCategoryInfo(entry.data.category).name
            : null;

        return (
          <LinkWithOriginal
            href={`/a/${entry.id}`}
            Icon={FileText}
            iconCorner={onlyImagesInChildren}
            original={display}
            preview={
              <FeedCardTemplate
                headless
                kind="article"
                time={new Date(entry.data.time * 1000)}
                metaTags={categoryName ? [categoryName] : undefined}
                title={entry.data.title}
                content={entry.data.summary?.trim() || undefined}
                tags={entry.data.tags?.length ? entry.data.tags : undefined}
                metrics={[
                  {
                    icon: MessageCircle,
                    children: `${entry.data.replyCount}\u2009评论`,
                  },
                  {
                    icon: Star,
                    children: `${entry.data.favorCount}\u2009收藏`,
                  },
                  {
                    icon: ThumbsUp,
                    children: `${entry.data.upvote}\u2009赞同`,
                  },
                ]}
                user={{ ...entry.data.author, id: entry.data.author.uid }}
              />
            }
          />
        );
      }

      return (
        <Link href={`/a/${entry.id}`} className={className} {...rest}>
          <FileText
            className="relative top-[0.03125em] me-0.5 -mt-[0.25em] inline-block size-[1em]"
            aria-hidden="true"
          />
          {children ?? (linkLabel || `文章\u2009${entry.id}`)}
        </Link>
      );
    }

    if (entry?.type === "paste") {
      if (entry.data) {
        const display = isLinkTextUseful({
          href: trueUrl,
          text: linkLabel,
          rawSource: linkTextSource,
          kind: "paste",
          referenceId: entry.id,
        })
          ? (children ?? (linkLabel || `云剪贴板\u2009${entry.id}`))
          : `云剪贴板\u2009${entry.id}`;

        return (
          <LinkWithOriginal
            href={`/p/${entry.id}`}
            Icon={ClipboardList}
            iconCorner={onlyImagesInChildren}
            original={display}
            preview={
              <FeedCardTemplate
                headless
                kind="paste"
                time={new Date(entry.data.time * 1000)}
                title={`云剪贴板\u2009${entry.id}`}
                content={entry.data.data.slice(0, 140).trim() || "（空剪贴板）"}
                contentMaxLines={7}
                user={{ ...entry.data.user, id: entry.data.user.uid }}
              />
            }
          />
        );
      }

      return (
        <Link href={`/p/${entry.id}`} className={className} {...rest}>
          <ClipboardList
            className="relative top-[0.03125em] me-0.5 -mt-[0.25em] inline-block size-[1em]"
            aria-hidden="true"
          />
          {children ?? (linkLabel || `云剪贴板\u2009${entry.id}`)}
        </Link>
      );
    }

    if (entry?.type === "problem") {
      if (entry.data) {
        const display = isLinkTextUseful({
          href: trueUrl,
          text: linkLabel,
          rawSource: linkTextSource,
          kind: "problem",
          referenceTitle: entry.data.title,
          referenceId: entry.id,
        })
          ? (children ?? (linkLabel || `题目\u2009${entry.id}`))
          : entry.data.title;

        return (
          <LinkWithOriginal
            href={`https://www.luogu.com.cn/problem/${entry.id}`}
            Icon={Swords}
            iconCorner={onlyImagesInChildren}
            original={display}
            preview={
              <>
                <Swords
                  className={`ms-1 size-4 text-luogu-problem-${entry.data.difficulty ?? 0}`}
                  aria-hidden="true"
                />
                <span
                  className={`font-bold text-luogu-problem-${entry.data.difficulty ?? 0}`}
                >
                  {entry.data.pid}
                </span>
                <span className="me-1 text-foreground">{entry.data.title}</span>
              </>
            }
            singleLine
            targetBlank
          />
        );
      }

      return (
        <Link
          href={`https://www.luogu.com.cn/problem/${entry.id}`}
          className={className}
          {...rest}
          target="_blank"
          rel="noreferrer noopener"
        >
          <Swords
            className="relative top-[0.03125em] me-0.5 -mt-[0.25em] inline-block size-[1em]"
            aria-hidden="true"
          />
          {children ?? (linkLabel || `题目\u2009${entry.id}`)}
        </Link>
      );
    }

    if (entry?.type === "user") {
      if (entry.data) {
        // TODO: improve styles when both images and non-images are in children
        return !isLinkTextUseful({
          href: trueUrl,
          text: markdownLabel,
          rawSource: linkTextSource,
          kind: "user",
          referenceName: entry.data.name,
          referenceId: entry.id,
        }) ? (
          <UserMagicLinkDirect userInfo={entry.data} />
        ) : (
          <UserMagicLinkWithOriginal userInfo={entry.data}>
            {children ?? (linkLabel || trueUrl)}
          </UserMagicLinkWithOriginal>
        );
      }

      return (
        <Link href={trueUrl ?? "#"} className={className} {...rest}>
          {children ?? (linkLabel || trueUrl)}
        </Link>
      );
    }
  }

  const luoguRe =
    /^https?:\/\/(?:[a-zA-Z0-9\-\.]*\.)?luogu\.(?:com\.cn|com|org)(?:\/\S*)?/;
  return (
    <Link
      href={trueUrl ?? "#"}
      className={className}
      {...rest}
      target="_blank"
      rel="noreferrer noopener"
    >
      {luoguRe.test(trueUrl) && !onlyImagesInChildren ? (
        <Image
          className="relative -top-0.5 inline-block h-[1.5em] w-[1.05em]"
          src={luoguSvg}
          alt="洛谷"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </Link>
  );
}
