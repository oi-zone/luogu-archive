import { ClipboardList } from "lucide-react";

import { cn } from "@/lib/utils";

import LinkWithOriginal from "../link-with-original";
import { PasteLinkInfo, PasteMagicLinkContent } from "./direct";

export default function PasteMagicLinkWithOriginal({
  pasteSummary,
  children,
  iconCorner = false,
}: {
  pasteSummary: PasteLinkInfo;
  children: React.ReactNode;
  iconCorner?: boolean;
}) {
  return (
    <LinkWithOriginal
      href={`/a/${pasteSummary.id}`}
      Icon={ClipboardList}
      original={children}
      iconCorner={iconCorner}
      preview={
        <span
          className={cn(
            "clear-markdown-style relative top-0.5 -mt-0.5",
            "ls-paste-link inline-flex items-center gap-2 rounded-full px-2.75 py-1 text-sm font-medium text-foreground no-underline",
          )}
        >
          <PasteMagicLinkContent pasteSummary={pasteSummary} />
        </span>
      }
    />
  );
}
