import { cn } from "@/lib/utils";

type MetaItemProps = {
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
        "text-muted-foreground inline-flex items-center gap-1.5",
        compact && "gap-1",
      )}
    >
      {Icon && <Icon className="size-3.5" aria-hidden="true" />}
      <span>{children}</span>
    </span>
  );
}
