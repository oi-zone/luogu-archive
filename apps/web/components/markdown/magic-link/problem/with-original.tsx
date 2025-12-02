import { Swords } from "lucide-react";

import { cn } from "@/lib/utils";

import LinkWithOriginal from "../link-with-original";
import { ProblemLinkInfo, ProblemMagicLinkContent } from "./direct";

export default function ProblemMagicLinkWithOriginal({
  problemInfo,
  children,
  iconCorner = false,
}: {
  problemInfo: ProblemLinkInfo;
  children: React.ReactNode;
  iconCorner?: boolean;
}) {
  return (
    <LinkWithOriginal
      href={`https://www.luogu.com.cn/problem/${problemInfo.pid}`}
      Icon={Swords}
      original={children}
      iconCorner={iconCorner}
      preview={
        <span
          className={cn(
            "clear-markdown-style",
            "ls-problem-link inline-flex items-center gap-1 rounded-full px-2.5 py-0.75 text-sm font-medium text-foreground no-underline",
          )}
        >
          <ProblemMagicLinkContent problemInfo={problemInfo} />
        </span>
      }
    />
  );
}
