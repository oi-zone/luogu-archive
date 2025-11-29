import { MessagesSquare } from "lucide-react";

import { cn } from "@/lib/utils";

import LinkWithOriginal from "../link-with-original";
import { DiscussionLinkInfo, DiscussionMagicLinkContent } from "./direct";

export default function DiscussionMagicLinkWithOriginal({
  discussionSummary,
  children,
}: {
  discussionSummary: DiscussionLinkInfo;
  children: React.ReactNode;
}) {
  return (
    <LinkWithOriginal
      href={`/d/${discussionSummary.id}`}
      Icon={MessagesSquare}
      original={children}
      preview={
        <span
          className={cn(
            "clear-markdown-style relative top-0.5 -mt-0.5",
            "ls-discussion-link inline-flex items-center gap-2 rounded-full px-2.75 py-1 text-sm font-medium text-foreground no-underline",
          )}
        >
          <DiscussionMagicLinkContent discussionSummary={discussionSummary} />
        </span>
      }
    />
  );
}
