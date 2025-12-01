import { Camera, ClipboardList, Globe, Lock } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import MetaItem from "@/components/meta/meta-item";

export type PasteLinkInfo = {
  id: string;
  title: string;
  capturedAt: string;
  lastSeenAt: string;
  isPublic: boolean;
  snapshotsCount: number;
};

export default function PasteMagicLinkDirect({
  pasteSummary,
}: {
  pasteSummary: PasteLinkInfo;
}) {
  return (
    <Link
      href={`/p/${pasteSummary.id}`}
      className={cn(
        "clear-markdown-style relative top-0.5 -my-0.5",
        "ls-discussion-link inline-flex items-center gap-2 rounded-full px-2.75 py-1 text-sm font-medium text-foreground no-underline",
        "bg-gray-100 transition duration-200 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800",
      )}
    >
      <PasteMagicLinkContent pasteSummary={pasteSummary} />
    </Link>
  );
}

export function PasteMagicLinkContent({
  pasteSummary,
}: {
  pasteSummary: PasteLinkInfo;
}) {
  return (
    <>
      <span>
        <span className="text-magic relative top-0.5 inline-flex items-center gap-1">
          <ClipboardList
            className="icon inline-block size-3.5"
            aria-hidden="true"
          />
          云剪贴板&thinsp;{pasteSummary.id}
        </span>
      </span>
      <span className="relative top-0.5 inline-block">
        <MetaItem icon={Camera} compact>
          {pasteSummary.snapshotsCount.toLocaleString("zh-CN")}
        </MetaItem>
      </span>
      <span className="relative top-0.5 inline-block">
        <MetaItem icon={pasteSummary.isPublic ? Globe : Lock} compact>
          {pasteSummary.isPublic ? "公开" : "私密"}
        </MetaItem>
      </span>
    </>
  );
}
