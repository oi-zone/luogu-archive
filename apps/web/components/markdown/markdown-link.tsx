"use client";

import * as React from "react";
import luoguSvg from "@/app/luogu.svg";
import { useQuery } from "@tanstack/react-query";
import {
  AtSign,
  ClipboardList,
  FileText,
  MessageSquareReply,
  MessagesSquare,
  Swords,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

import UserInlineLink, { type UserBasicInfo } from "../user/user-inline-link";
import {
  articleRegexes,
  captureFromFirstMatch,
  discussionRegexes,
  pasteRegexes,
  problemRegexes,
  userRegexes,
} from "./link";
import ArticleMagicLinkDirect, {
  ArticleLinkInfo,
} from "./magic-link/article/direct";
import ArticleMagicLinkWithOriginal from "./magic-link/article/with-original";
import DiscussionMagicLinkDirect, {
  DiscussionLinkInfo,
} from "./magic-link/discussion/direct";
import DiscussionMagicLinkWithOriginal from "./magic-link/discussion/with-original";
import PasteMagicLinkDirect, { PasteLinkInfo } from "./magic-link/paste/direct";
import PasteMagicLinkWithOriginal from "./magic-link/paste/with-original";
import ProblemMagicLinkDirect, {
  ProblemLinkInfo,
} from "./magic-link/problem/direct";
import ProblemMagicLinkWithOriginal from "./magic-link/problem/with-original";
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
  "data-ls-discussion"?: string;
  "data-ls-article"?: string;
  "data-ls-user"?: string;
  "data-ls-paste"?: string;
  "data-ls-problem"?: string;
  "data-ls-link-text"?: string;
  "data-ls-link-source"?: string;
  mentionContext?: MarkdownMentionContext;
};

type MentionUser = UserBasicInfo;

async function fetchUser(uid: number): Promise<MentionUser> {
  const response = await fetch(`/api/users/${uid}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load user");
  }
  return response.json();
}

async function fetchDiscussionSummary(
  discussionId: number,
): Promise<DiscussionLinkInfo> {
  const response = await fetch(`/api/discussions/${discussionId}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to load discussion");
  }
  return response.json();
}

async function fetchArticleSummary(
  articleId: string,
): Promise<ArticleLinkInfo> {
  const response = await fetch(`/api/articles/${articleId}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to load article");
  }
  return response.json();
}

async function fetchPasteSummary(pasteId: string): Promise<PasteLinkInfo> {
  const response = await fetch(`/api/pastes/${pasteId}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load paste");
  }
  return response.json();
}

async function fetchProblemInfo(pid: string): Promise<ProblemLinkInfo> {
  const response = await fetch(`/api/problems/${pid}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load problem");
  }
  const data = await response.json();
  return {
    pid: data.pid,
    title: data.title,
    difficulty: data.difficulty ?? null,
    solutionsCount: data.solutionsCount ?? 0,
  } satisfies ProblemLinkInfo;
}

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

  console.log("MarkdownLink href:", href, isBlankLink);

  const trueUrl = isBlankLink
    ? "#"
    : new URL(
        href ?? "",
        originalUrl ?? "https://www.luogu.com.cn/",
      ).toString();
  const uidMentionParam = props["data-ls-user-mention"];
  const uidLinkParam = props["data-ls-user"];
  const uidParam = uidMentionParam ?? uidLinkParam;

  const parsedUid = uidParam ? Number.parseInt(uidParam, 10) : Number.NaN;
  const uid = Number.isNaN(parsedUid) ? undefined : parsedUid;

  const discussionIdParam = props["data-ls-discussion"];
  const parsedDiscussionId = discussionIdParam
    ? Number.parseInt(discussionIdParam, 10)
    : Number.NaN;
  const discussionId = Number.isNaN(parsedDiscussionId)
    ? undefined
    : parsedDiscussionId;

  const articleId = props["data-ls-article"];
  const pasteId = props["data-ls-paste"];
  const problemId = props["data-ls-problem"];

  const { data: userInfo } = useQuery<MentionUser>({
    queryKey: ["user", uid],
    queryFn: () => fetchUser(uid!),
    enabled: uid !== undefined,
  });

  const { data: discussionSummary } = useQuery<DiscussionLinkInfo>({
    queryKey: ["discussion", discussionId],
    queryFn: () => fetchDiscussionSummary(discussionId!),
    enabled: discussionId !== undefined,
  });

  const { data: articleSummary } = useQuery<ArticleLinkInfo>({
    queryKey: ["article", articleId],
    queryFn: () => fetchArticleSummary(articleId!),
    enabled: Boolean(articleId),
  });

  const { data: pasteSummary } = useQuery<PasteLinkInfo>({
    queryKey: ["paste", pasteId],
    queryFn: () => fetchPasteSummary(pasteId!),
    enabled: Boolean(pasteId),
  });

  const { data: problemInfo } = useQuery<ProblemLinkInfo>({
    queryKey: ["problem", problemId],
    queryFn: () => fetchProblemInfo(problemId!),
    enabled: Boolean(problemId),
  });

  const onlyImagesInChildren = onlyHasImageChildren(children);

  if (uidMentionParam) {
    if (userInfo) {
      const shouldEnableInference =
        mentionContext?.kind === "discussion" &&
        mentionContext.discussionId !== undefined &&
        mentionContext.relativeReplyId !== undefined;

      return (
        <span className="ls-user-mention inline-flex items-center gap-0.25">
          <AtSign
            className={cn(
              "relative top-0.5 inline-block size-4 stroke-[1.75]",
              // `text-luogu-${userInfo.color.toLowerCase()}`,
            )}
          />
          <span className="relative top-1 -ms-0.75 -mt-1 inline-flex items-center gap-0">
            <UserInlineLink user={userInfo} compact avatar={false} />
            {shouldEnableInference && (
              <MentionReplyOverlayTrigger
                discussionId={mentionContext.discussionId}
                mentionUserId={userInfo.id}
                relativeReplyId={mentionContext.relativeReplyId}
                className="me-0.75 inline-flex cursor-pointer items-center gap-0.75 rounded-full bg-background/50 px-1.75 py-1.25 shadow-sm ring-1 ring-border backdrop-blur-xs transition duration-200 select-none hover:-translate-y-0.25 hover:shadow"
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
        <span className="relative top-1 ms-0.25 -mt-1 inline-flex items-center gap-0 text-primary">
          {children ?? linkLabel}
        </span>
      </span>
    );
  }

  if (!isBlankLink) {
    if (discussionIdParam) {
      if (discussionSummary) {
        return !isLinkTextUseful({
          href: trueUrl,
          text: linkLabel,
          rawSource: linkTextSource,
          kind: "discussion",
          referenceTitle: discussionSummary.title,
          referenceId: discussionId?.toString(),
        }) ? (
          <DiscussionMagicLinkDirect discussionSummary={discussionSummary} />
        ) : (
          <DiscussionMagicLinkWithOriginal
            discussionSummary={discussionSummary}
            iconCorner={onlyImagesInChildren}
          >
            {children ?? (linkLabel || `讨论\u2009${discussionId}`)}
          </DiscussionMagicLinkWithOriginal>
        );
      }

      return (
        <Link href={`/d/${discussionId}`} className={className} {...rest}>
          <MessagesSquare
            className="relative top-[0.03125em] me-0.5 -mt-[0.25em] inline-block size-[1em]"
            aria-hidden="true"
          />
          {children ?? (linkLabel || `讨论\u2009${discussionId}`)}
        </Link>
      );
    }

    if (articleId) {
      if (articleSummary) {
        return !isLinkTextUseful({
          href: trueUrl,
          text: linkLabel,
          rawSource: linkTextSource,
          kind: "article",
          referenceTitle: articleSummary.title,
          referenceId: articleId,
        }) ? (
          <ArticleMagicLinkDirect articleSummary={articleSummary} />
        ) : (
          <ArticleMagicLinkWithOriginal
            articleSummary={articleSummary}
            iconCorner={onlyImagesInChildren}
          >
            {children ?? (linkLabel || `文章\u2009${articleId}`)}
          </ArticleMagicLinkWithOriginal>
        );
      }

      return (
        <Link href={`/a/${articleId}`} className={className} {...rest}>
          <FileText
            className="relative top-[0.03125em] me-0.5 -mt-[0.25em] inline-block size-[1em]"
            aria-hidden="true"
          />
          {children ?? (linkLabel || `文章\u2009${articleId}`)}
        </Link>
      );
    }

    if (pasteId) {
      if (pasteSummary) {
        return !isLinkTextUseful({
          href: trueUrl,
          text: linkLabel,
          rawSource: linkTextSource,
          kind: "paste",
          referenceId: pasteId,
        }) ? (
          <PasteMagicLinkDirect pasteSummary={pasteSummary} />
        ) : (
          <PasteMagicLinkWithOriginal
            pasteSummary={pasteSummary}
            iconCorner={onlyImagesInChildren}
          >
            {children ?? (linkLabel || `云剪贴板\u2009${pasteId}`)}
          </PasteMagicLinkWithOriginal>
        );
      }

      return (
        <Link href={`/p/${pasteId}`} className={className} {...rest}>
          <ClipboardList
            className="relative top-[0.03125em] me-0.5 -mt-[0.25em] inline-block size-[1em]"
            aria-hidden="true"
          />
          {children ?? (linkLabel || `云剪贴板\u2009${pasteId}`)}
        </Link>
      );
    }

    if (problemId) {
      if (problemInfo) {
        return !isLinkTextUseful({
          href: trueUrl,
          text: linkLabel,
          rawSource: linkTextSource,
          kind: "problem",
          referenceTitle: problemInfo.title,
          referenceId: problemId,
        }) ? (
          <ProblemMagicLinkDirect problemInfo={problemInfo} />
        ) : (
          <ProblemMagicLinkWithOriginal
            problemInfo={problemInfo}
            iconCorner={onlyImagesInChildren}
          >
            {children ?? (linkLabel || `题目\u2009${problemId}`)}
          </ProblemMagicLinkWithOriginal>
        );
      }

      return (
        <Link
          href={`https://www.luogu.com.cn/problem/${problemId}`}
          className={className}
          {...rest}
        >
          <Swords
            className="relative top-[0.03125em] me-0.5 -mt-[0.25em] inline-block size-[1em]"
            aria-hidden="true"
          />
          {children ?? (linkLabel || `题目\u2009${problemId}`)}
        </Link>
      );
    }

    if (uidLinkParam) {
      if (userInfo) {
        // TODO: improve styles when both images and non-images are in children
        return !isLinkTextUseful({
          href: trueUrl,
          text: markdownLabel,
          rawSource: linkTextSource,
          kind: "user",
          referenceName: userInfo.name,
          referenceId: userInfo.id.toString(),
        }) ? (
          <UserMagicLinkDirect userInfo={userInfo} />
        ) : (
          <UserMagicLinkWithOriginal userInfo={userInfo}>
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
    <Link href={trueUrl ?? "#"} className={className} {...rest}>
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
