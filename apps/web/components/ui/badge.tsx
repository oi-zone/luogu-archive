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
      className={cn("select-none rounded-full", className, {
        "py-0.25 px-1.25 text-xs": (size ?? "md") === "md",
        "py-0.25 px-1.75 text-sm": size === "lg",
        "py-0.25 px-2.25 text-base": size === "xl",
      })}
    >
      {children}
    </span>
  );
}
