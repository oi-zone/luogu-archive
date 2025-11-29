"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AtSign,
  Camera,
  ClipboardList,
  FileText,
  Globe,
  Lock,
  MessageCircle,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import MetaItem from "../meta/meta-item";
import UserInlineLink, { type UserBasicInfo } from "../user/user-inline-link";

type MarkdownLinkProps = React.ComponentProps<"a"> & {
  originalUrl?: string;
  "data-ls-user-mention"?: string;
  "data-ls-discussion"?: string;
  "data-ls-article"?: string;
  "data-ls-user"?: string;
  "data-ls-paste"?: string;
};

type MentionUser = UserBasicInfo;

type DiscussionLinkInfo = {
  id: number;
  title: string;
  capturedAt: string;
  lastSeenAt: string;
  forum: { slug: string; name: string } | null;
  allRepliesCount: number;
  snapshotsCount: number;
};

type ArticleLinkInfo = {
  id: string;
  title: string;
  capturedAt: string;
  lastSeenAt: string;
  allRepliesCount: number;
  snapshotsCount: number;
};

type PasteLinkInfo = {
  id: string;
  title: string;
  capturedAt: string;
  lastSeenAt: string;
  isPublic: boolean;
  snapshotsCount: number;
};

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

export default function MarkdownLink(props: MarkdownLinkProps) {
  const { href, children, className, originalUrl, ...rest } = props;

  const trueUrl = new URL(
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

  if (uidMentionParam) {
    if (userInfo) {
      return (
        <span className="ls-user-mention me-0.5">
          <AtSign
            className={cn(
              "relative -top-0.25 inline-block size-4 stroke-[1.5]",
              `text-luogu-${userInfo.color.toLowerCase()}`,
            )}
          />
          <span className="relative top-1 ms-0.25 -mt-1 inline-block">
            <UserInlineLink user={userInfo} compact />
          </span>
        </span>
      );
    }

    return <span className="text-primary">@user={children}</span>;
  }

  if (discussionIdParam) {
    if (discussionSummary) {
      return (
        <Link
          href={`/d/${discussionSummary.id}`}
          className={cn(
            "clear-markdown-style relative top-0.5 -my-0.5",
            "ls-discussion-link inline-flex items-center gap-2 rounded-full px-2.75 py-1 text-sm font-medium text-foreground no-underline",
            "bg-gray-100 transition duration-200 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800",
            className,
          )}
          {...rest}
        >
          <MessageSquare
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <span>
            {discussionSummary.title}
            <span className="align-bottom text-xs text-muted-foreground">
              #{discussionSummary.id}
            </span>
          </span>
          <span className="relative top-0.25 inline-block">
            <MetaItem icon={MessageCircle} compact>
              {discussionSummary.allRepliesCount.toLocaleString("zh-CN")}
            </MetaItem>
          </span>
          <span className="relative top-0.25 inline-block">
            <MetaItem icon={Camera} compact>
              {discussionSummary.snapshotsCount.toLocaleString("zh-CN")}
            </MetaItem>
          </span>
        </Link>
      );
    }

    return (
      <Link href={`/d/${discussionId}`} className={className} {...rest}>
        {children ?? `讨论 ${discussionId}`}
      </Link>
    );
  }

  if (articleId) {
    if (articleSummary) {
      return (
        <Link
          href={`/a/${articleSummary.id}`}
          className={cn(
            "clear-markdown-style relative top-0.5 -my-0.5",
            "ls-discussion-link inline-flex items-center gap-2 rounded-full px-2.75 py-1 text-sm font-medium text-foreground no-underline",
            "bg-gray-100 transition duration-200 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800",
            className,
          )}
          {...rest}
        >
          <FileText
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <span>
            {articleSummary.title}
            <span className="align-bottom text-xs text-muted-foreground">
              #{articleSummary.id}
            </span>
          </span>
          <span className="relative top-0.25 inline-block">
            <MetaItem icon={MessageCircle} compact>
              {articleSummary.allRepliesCount.toLocaleString("zh-CN")}
            </MetaItem>
          </span>
          <span className="relative top-0.25 inline-block">
            <MetaItem icon={Camera} compact>
              {articleSummary.snapshotsCount.toLocaleString("zh-CN")}
            </MetaItem>
          </span>
        </Link>
      );
    }

    return (
      <Link href={`/a/${articleId}`} className={className} {...rest}>
        {children ?? `文章 ${articleId}`}
      </Link>
    );
  }

  if (pasteId) {
    if (pasteSummary) {
      return (
        <Link
          href={`/p/${pasteSummary.id}`}
          className={cn(
            "clear-markdown-style relative top-0.5 -my-0.5",
            "ls-discussion-link inline-flex items-center gap-2 rounded-full px-2.75 py-1 text-sm font-medium text-foreground no-underline",
            "bg-gray-100 transition duration-200 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800",
            className,
          )}
          {...rest}
        >
          <ClipboardList
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <span>云剪贴板&thinsp;{pasteSummary.id}</span>
          <span className="relative top-0.25 inline-block">
            <MetaItem icon={Camera} compact>
              {pasteSummary.snapshotsCount.toLocaleString("zh-CN")}
            </MetaItem>
          </span>
          <span className="relative top-0.25 inline-block">
            <MetaItem icon={pasteSummary.isPublic ? Globe : Lock} compact>
              {pasteSummary.isPublic ? "公开" : "私密"}
            </MetaItem>
          </span>
        </Link>
      );
    }

    return (
      <Link href={`/p/${pasteId}`} className={className} {...rest}>
        {children ?? `云剪贴板 ${pasteId}`}
      </Link>
    );
  }

  if (uidLinkParam) {
    if (userInfo) {
      return (
        <span className="relative top-1 -mt-1 inline-block">
          <UserInlineLink user={userInfo} compact />
        </span>
      );
    }
    return (
      <Link href={trueUrl ?? "#"} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <Link href={trueUrl ?? "#"} className={className}>
      {children}
    </Link>
  );
}
