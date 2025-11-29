import { Camera, MessageCircle, MessagesSquare } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import MetaItem from "@/components/meta/meta-item";

export type DiscussionLinkInfo = {
  id: number;
  title: string;
  capturedAt: string;
  lastSeenAt: string;
  forum: { slug: string; name: string } | null;
  allRepliesCount: number;
  snapshotsCount: number;
};

export default function DiscussionMagicLinkDirect({
  discussionSummary,
}: {
  discussionSummary: DiscussionLinkInfo;
}) {
  return (
    <Link
      href={`/d/${discussionSummary.id}`}
      className={cn(
        "clear-markdown-style relative top-0.5 -mt-0.5",
        "ls-discussion-link inline-flex items-center gap-2 rounded-full px-2.75 py-1 text-sm font-medium text-foreground no-underline",
        "bg-gray-100 transition duration-200 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800",
      )}
    >
      <DiscussionMagicLinkContent discussionSummary={discussionSummary} />
    </Link>
  );
}

export function DiscussionMagicLinkContent({
  discussionSummary,
}: {
  discussionSummary: DiscussionLinkInfo;
}) {
  return (
    <>
      <MessagesSquare
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
    </>
  );
}
