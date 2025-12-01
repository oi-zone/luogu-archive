import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type LinkWithOriginalProps = {
  href: React.ComponentProps<typeof Link>["href"];
  Icon: LucideIcon;
  preview: React.ReactNode;
  original: React.ReactNode;
  className?: string;
  iconCorner?: boolean;
};

export default function LinkWithOriginal({
  href,
  Icon,
  preview,
  original,
  className,
  iconCorner = false,
}: LinkWithOriginalProps) {
  return (
    <LinkWithOriginalRaw
      preview={preview}
      originalRaw={
        <Link
          href={href}
          className={cn(
            "ls-inline-reference ls-link-preview clear-markdown-style relative no-underline",
            { "text-magic-interactive mx-0.25": !iconCorner },
          )}
        >
          {iconCorner ? (
            <div className="absolute -top-2.25 -right-1.5 rounded-full bg-orange-500/60 p-0.5 leading-0">
              <Icon className="m-0.5 inline-block size-3.5 stroke-[1.75] text-white" />
            </div>
          ) : (
            <Icon className="icon relative top-[0.03125em] me-0.5 -mt-[0.25em] inline-block size-[1em]" />
          )}
          <span>{original}</span>
        </Link>
      }
      className={className}
    />
  );
}

type LinkWithOriginalRawProps = {
  preview: React.ReactNode;
  originalRaw: React.ReactNode;
  className?: string;
  outerClassName?: string;
};

export function LinkWithOriginalRaw({
  preview,
  originalRaw,
  className,
  outerClassName,
}: LinkWithOriginalRawProps) {
  return (
    <span className={cn("relative", outerClassName)}>
      <span className={cn("peer inline-block", className)}>{originalRaw}</span>
      <span
        role="tooltip"
        aria-hidden="true"
        className={cn(
          "max-w-90vw pointer-events-none absolute top-[1.2em] -left-[0.5em] z-20 mt-1 flex w-max rounded-full bg-background/60 p-1 whitespace-nowrap shadow-lg ring-1 ring-border backdrop-blur-xs",
          "opacity-0 peer-hover:opacity-100 peer-focus:opacity-100",
          // "origin-top scale-y-0 peer-focus:scale-100 peer-hover:scale-100 focus:scale-100 hover:scale-100 transform-gpu",
          "transition-all duration-120",
        )}
      >
        {preview}
      </span>
    </span>
  );
}
