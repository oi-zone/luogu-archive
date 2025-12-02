import { MessagesSquare } from "lucide-react";

import { cn } from "@/lib/utils";

import LinkWithOriginal from "../link-with-original";
import { DiscussionLinkInfo, DiscussionMagicLinkContent } from "./direct";

export default function DiscussionMagicLinkWithOriginal({
  discussionSummary,
  children,
  iconCorner = false,
}: {
  discussionSummary: DiscussionLinkInfo;
  children: React.ReactNode;
  iconCorner?: boolean;
}) {
  return (
    <LinkWithOriginal
      href={`/d/${discussionSummary.id}`}
      Icon={MessagesSquare}
      original={children}
      iconCorner={iconCorner}
      preview={
        <span
          className={cn(
            "clear-markdown-style",
            "ls-discussion-link inline-flex items-center gap-2 rounded-full px-2.5 py-0.75 text-sm font-medium text-foreground no-underline",
          )}
        >
          <DiscussionMagicLinkContent discussionSummary={discussionSummary} />
        </span>
      }
    />
  );
}
