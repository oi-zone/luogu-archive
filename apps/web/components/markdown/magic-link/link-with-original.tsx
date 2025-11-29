import { LucideProps } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type LinkWithPreviewProps = {
  href: React.ComponentProps<typeof Link>["href"];
  Icon: React.ForwardRefExoticComponent<
    Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>
  >;
  preview: React.ReactNode;
  original: React.ReactNode;
  linkProps?: Omit<React.ComponentProps<typeof Link>, "href" | "children">;
};

export default function LinkWithOriginal({
  href,
  Icon,
  preview,
  original,
  linkProps,
}: LinkWithPreviewProps) {
  const { className: inlineClassName, ...restLinkProps } = linkProps ?? {};
  return (
    <span className="group/link-preview relative align-baseline">
      <Link
        href={href}
        {...restLinkProps}
        className={cn(
          "ls-inline-reference ls-link-preview clear-markdown-style mx-0.25 no-underline",
          inlineClassName,
        )}
      >
        <Icon className="relative top-[0.03125em] me-0.5 -mt-[0.25em] inline-block size-[1em]" />
        <span>{original}</span>
      </Link>
      <span
        role="tooltip"
        aria-hidden="true"
        className="max-w-90vw pointer-events-auto absolute top-[1.2em] -left-[0.5em] z-20 mt-1 hidden w-max rounded-full bg-background/60 p-1 whitespace-nowrap shadow-lg ring-1 ring-border backdrop-blur group-focus-within/link-preview:flex group-hover/link-preview:flex"
      >
        {preview}
      </span>
    </span>
  );
}
