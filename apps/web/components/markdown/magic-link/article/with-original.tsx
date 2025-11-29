import { FileText } from "lucide-react";

import { cn } from "@/lib/utils";

import LinkWithOriginal from "../link-with-original";
import { ArticleLinkInfo, ArticleMagicLinkContent } from "./direct";

export default function ArticleMagicLinkWithOriginal({
  articleSummary,
  children,
}: {
  articleSummary: ArticleLinkInfo;
  children: React.ReactNode;
}) {
  return (
    <LinkWithOriginal
      href={`/a/${articleSummary.id}`}
      Icon={FileText}
      original={children}
      preview={
        <span
          className={cn(
            "clear-markdown-style relative top-0.5 -mt-0.5",
            "ls-article-link inline-flex items-center gap-2 rounded-full px-2.75 py-1 text-sm font-medium text-foreground no-underline",
          )}
        >
          <ArticleMagicLinkContent articleSummary={articleSummary} />
        </span>
      }
    />
  );
}
