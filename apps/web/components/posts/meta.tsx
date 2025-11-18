import React from "react";

import { cn } from "@/lib/utils";

import { UserInlineLink } from "../user/user-inline-link";

type MetaRowProps = {
  author: {
    username: string;
    name: string;
    color: string;
    tag?: string;
    ccfLevel?: number;
    avatarUrl: string;
  };
  compact?: boolean;
  className?: string;
  children?: React.ReactNode;
};

const MetaRow = React.forwardRef<HTMLDivElement, MetaRowProps>(
  ({ author, compact = false, className, children }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-sm",
          compact && "text-xs",
          className,
        )}
      >
        <UserInlineLink user={author} className={cn(compact && "text-xs")} />
        {children}
      </div>
    );
  },
);
MetaRow.displayName = "MetaRow";

type MetaItemProps = {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  children: React.ReactNode;
  compact?: boolean;
};

function MetaItem({ icon: Icon, children, compact = false }: MetaItemProps) {
  return (
    <span
      className={cn(
        "text-muted-foreground inline-flex items-center gap-1.5",
        compact && "gap-1",
      )}
    >
      <Icon
        className={cn("size-3.5", compact && "size-3")}
        aria-hidden="true"
      />
      <span>{children}</span>
    </span>
  );
}

function SeparatorDot() {
  return <span className="text-muted-foreground/60">·</span>;
}
