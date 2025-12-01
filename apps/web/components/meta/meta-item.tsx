import { cn } from "@/lib/utils";

export type MetaItemProps = {
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  children: React.ReactNode;
  compact?: boolean;
};

export default function MetaItem({
  icon: Icon,
  children,
  compact = false,
}: MetaItemProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-muted-foreground",
        compact && "gap-1",
      )}
    >
      {Icon && <Icon className="size-3.5" aria-hidden="true" />}
      <span className={cn(compact && "text-sm")}>{children}</span>
    </span>
  );
}
