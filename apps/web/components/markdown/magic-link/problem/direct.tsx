import { Swords } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type ProblemLinkInfo = {
  pid: string;
  title: string;
  difficulty: number | null;
  solutionsCount: number;
};

export default function ProblemMagicLinkDirect({
  problemInfo,
}: {
  problemInfo: ProblemLinkInfo;
}) {
  return (
    <Link
      href={`https://www.luogu.com.cn/problem/${problemInfo.pid}`}
      className={cn(
        "clear-markdown-style relative top-0.5 -my-0.5",
        "ls-discussion-link inline-flex items-center gap-2 rounded-full px-2.75 py-1 text-sm font-medium text-foreground no-underline",
        "bg-gray-100 transition duration-200 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800",
      )}
    >
      <ProblemMagicLinkContent problemInfo={problemInfo} />
    </Link>
  );
}

export function ProblemMagicLinkContent({
  problemInfo,
}: {
  problemInfo: ProblemLinkInfo;
}) {
  return (
    <>
      <Swords
        className={`size-4 text-luogu-problem-${problemInfo.difficulty ?? 0}`}
        aria-hidden="true"
      />
      <span
        className={`font-bold text-luogu-problem-${problemInfo.difficulty ?? 0}`}
      >
        {problemInfo.pid}
      </span>
      <span>{problemInfo.title}</span>
    </>
  );
}
