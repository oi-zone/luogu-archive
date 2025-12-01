import { Swords } from "lucide-react";

import { cn } from "@/lib/utils";

import LinkWithOriginal from "../link-with-original";
import { ProblemLinkInfo, ProblemMagicLinkContent } from "./direct";

export default function ProblemMagicLinkWithOriginal({
  problemInfo,
  children,
}: {
  problemInfo: ProblemLinkInfo;
  children: React.ReactNode;
}) {
  return (
    <LinkWithOriginal
      href={`https://www.luogu.com.cn/problem/${problemInfo.pid}`}
      Icon={Swords}
      original={children}
      preview={
        <span
          className={cn(
            "clear-markdown-style relative top-0.5 -mt-0.5",
            "ls-problem-link inline-flex items-center gap-2 rounded-full px-2.75 py-1 text-sm font-medium text-foreground no-underline",
          )}
        >
          <ProblemMagicLinkContent problemInfo={problemInfo} />
        </span>
      }
    />
  );
}
