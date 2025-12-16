import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import LinkWithOriginalRaw from "./link-with-original-raw";

type LinkWithOriginalProps = {
  href: React.ComponentProps<typeof Link>["href"];
  Icon: LucideIcon;
  preview: React.ReactNode;
  original: React.ReactNode;
  className?: string;
  iconCorner?: boolean;
  singleLine?: boolean;
  targetBlank?: boolean;
};

export default function LinkWithOriginal({
  href,
  Icon,
  preview,
  original,
  className,
  iconCorner = false,
  singleLine = false,
  targetBlank = false,
}: LinkWithOriginalProps) {
  return (
    <LinkWithOriginalRaw
      preview={preview}
      originalRaw={
        <Link
          href={href}
          className={cn(
            "ls-inline-reference ls-link-preview relative no-underline",
            { "mx-0.25": !iconCorner },
          )}
          target={targetBlank ? "_blank" : undefined}
          rel={targetBlank ? "noreferrer noopener" : undefined}
        >
          {iconCorner ? (
            <div className="absolute -top-0.5 right-0.25 rounded-full bg-orange-500/60 p-0.5 leading-0">
              <Icon className="m-0.5 inline-block size-3.5 stroke-[1.75] text-white" />
            </div>
          ) : (
            <Icon className="icon relative top-[0.03125em] me-0.5 -mt-[0.25em] inline-block size-[1em]" />
          )}
          <span>{original}</span>
        </Link>
      }
      className={className}
      singleLine={singleLine}
    />
  );
}
