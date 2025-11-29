import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
  size,
}: {
  children: React.ReactNode;
  className?: string;
  size?: "md" | "lg" | "xl";
}) {
  return (
    <span
      className={cn("rounded-full select-none", className, {
        "px-1.25 py-0.25 text-xs": (size ?? "md") === "md",
        "px-1.75 py-0.25 text-sm": size === "lg",
        "px-2.25 py-0.25 text-base": size === "xl",
      })}
    >
      {children}
    </span>
  );
}
