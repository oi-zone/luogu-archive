import { Camera, FileText, MessageCircle } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import MetaItem from "@/components/meta/meta-item";

export type ArticleLinkInfo = {
  id: string;
  title: string;
  capturedAt: string;
  lastSeenAt: string;
  allRepliesCount: number;
  snapshotsCount: number;
};

export default function ArticleMagicLinkDirect({
  articleSummary,
}: {
  articleSummary: ArticleLinkInfo;
}) {
  return (
    <Link
      href={`/a/${articleSummary.id}`}
      className={cn(
        "clear-markdown-style relative -top-0.25 -mt-0.5",
        "ls-article-link inline-flex items-center gap-2 rounded-full px-2.5 py-0.75 text-sm font-medium text-foreground no-underline",
        "bg-gray-100 transition duration-200 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800",
        "max-w-full overflow-hidden text-ellipsis whitespace-nowrap",
      )}
    >
      <ArticleMagicLinkContent articleSummary={articleSummary} />
    </Link>
  );
}

export function ArticleMagicLinkContent({
  articleSummary,
}: {
  articleSummary: ArticleLinkInfo;
}) {
  return (
    <>
      <span>
        <span className="text-magic relative top-0.5 inline-flex items-center gap-1">
          <FileText className="icon inline-block size-3.5" aria-hidden="true" />
          {articleSummary.title}
        </span>
        <span className="align-bottom text-xs text-muted-foreground">
          #{articleSummary.id}
        </span>
      </span>
      <span className="relative top-0.5 inline-block">
        <MetaItem icon={MessageCircle} compact className="gap-0.5">
          {articleSummary.allRepliesCount.toLocaleString("zh-CN")}
        </MetaItem>
      </span>
      <span className="relative top-0.5 inline-block">
        <MetaItem icon={Camera} compact className="gap-0.5">
          {articleSummary.snapshotsCount.toLocaleString("zh-CN")}
        </MetaItem>
      </span>
    </>
  );
}
