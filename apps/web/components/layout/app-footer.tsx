import { Github, Scale, Users } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

const LINKS: { label: string; href?: string }[] = [
  { label: "关于", href: "/about" },
  { label: "删除政策", href: "/takedown" },
  { label: "用户协议", href: "/terms" },
  { label: "隐私政策", href: "/privacy" },
  { label: "联系我们", href: "/contact" },
  { label: "招贤纳才", href: "/join" },
];
const REPO_URL = "https://github.com/oi-zone/luogu-archive";
const QQ_GROUP_URL =
  "https://qm.qq.com/cgi-bin/qm/qr?k=Ri6rACS0-el0LZO83yfbwLp-KV3_Ov34&jump_from=webapi&authKey=uhOW0unvRiSw9ftcWonXt32O6qVa5A4oZbQ0XcqcqamLLxtjX2RnfMU7ngJHs4Wn";

export function AppFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("border-t bg-background/70", className)}>
      <div className="mx-auto flex w-full flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {LINKS.map((item) => (
            <Link
              key={item.label}
              href={item.href ?? "#"}
              className={cn(
                "text-muted-foreground transition-colors hover:text-foreground",
                !item.href && "cursor-default", // placeholder links for now
              )}
              aria-disabled={!item.href}
              onClick={(event) => {
                if (!item.href) event.preventDefault();
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <Github className="relative -top-0.5 me-0.5 inline-block size-3.75" />
            GitHub&thinsp;仓库
          </Link>
          <span>
            <Scale className="relative -top-0.5 me-0.75 inline-block size-3.75" />
            基于&thinsp;
            <Link
              href={`${REPO_URL}?tab=AGPL-3.0-1-ov-file#readme`}
              target="_blank"
              rel="noreferrer noopener"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              AGPL-3.0&thinsp;协议
            </Link>
            开源
          </span>
          <Link
            href={QQ_GROUP_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <Users className="relative -top-0.5 me-0.75 inline-block size-3.75" />
            用户&thinsp;QQ&thinsp;群&thinsp;<code>149774448</code>
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-muted-foreground">
            &copy; 2025 全体&thinsp;oi.zone&thinsp;开发者
          </span>
        </div>
      </div>
    </footer>
  );
}
