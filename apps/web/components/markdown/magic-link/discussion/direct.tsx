import { Camera, MessageSquare, MessagesSquare } from "lucide-react";
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
        "clear-markdown-style relative -top-0.25 -mt-0.5",
        "ls-discussion-link inline-flex items-center gap-2 rounded-full px-2.5 py-0.75 text-sm font-medium text-foreground no-underline",
        "bg-gray-100 transition duration-200 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800",
        "max-w-full overflow-hidden text-ellipsis whitespace-nowrap",
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
      <span>
        <span className="text-magic relative top-0.5 inline-flex items-center gap-1">
          <MessagesSquare
            className="icon inline-block size-3.5"
            aria-hidden="true"
          />
          {discussionSummary.title}
        </span>
        <span className="align-bottom text-xs text-muted-foreground">
          #{discussionSummary.id}
        </span>
      </span>
      <span className="relative top-0.5 inline-block">
        <MetaItem icon={MessageSquare} compact className="gap-0.5">
          {discussionSummary.allRepliesCount.toLocaleString("zh-CN")}
        </MetaItem>
      </span>
      <span className="relative top-0.5 inline-block">
        <MetaItem icon={Camera} compact className="gap-0.5">
          {discussionSummary.snapshotsCount.toLocaleString("zh-CN")}
        </MetaItem>
      </span>
    </>
  );
}
