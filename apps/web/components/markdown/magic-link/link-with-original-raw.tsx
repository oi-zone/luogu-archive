"use client";

import * as React from "react";
import {
  autoUpdate,
  FloatingPortal,
  offset,
  shift,
  size,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from "@floating-ui/react";

import { cn } from "@/lib/utils";

type LinkWithOriginalRawProps = {
  preview: React.ReactNode;
  originalRaw: React.ReactNode;
  className?: string;
  outerClassName?: string;
};

export default function LinkWithOriginalRaw({
  preview,
  originalRaw,
  className,
  outerClassName,
}: LinkWithOriginalRawProps) {
  const [open, setOpen] = React.useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "bottom-start",
    middleware: [
      shift({ padding: 16 }),
      size({
        padding: 16,
        apply({ availableWidth, elements }) {
          const ideal = 800;
          const maxWidth = Math.min(ideal, availableWidth);
          Object.assign(elements.floating.style, {
            maxWidth: `${maxWidth}px`,
          });
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  // 交互（hover + focus + escape）
  const hover = useHover(context, {
    move: false, // 不随鼠标移动频繁重算
    restMs: 50,
  });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "tooltip" });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
  ]);

  return (
    <>
      {/* 触发元素：originalRaw */}
      <span className={cn("relative", outerClassName)}>
        <span
          ref={refs.setReference}
          {...getReferenceProps({
            className: cn("inline-block", className),
          })}
        >
          {originalRaw}
        </span>
      </span>

      {/* 悬浮窗：Portal 到 body，完全脱离任何 overflow 容器 */}
      <FloatingPortal>
        <span
          // eslint-disable-next-line react-hooks/refs
          ref={refs.setFloating}
          {...getFloatingProps({
            className: cn(
              "pointer-events-none z-50 mt-1 flex w-max rounded-full bg-background/60 p-0.5",
              "whitespace-nowrap overflow-hidden text-ellipsis",
              "shadow-lg ring-1 ring-border backdrop-blur-xs",
              "transition-opacity duration-120",
              open ? "opacity-100" : "opacity-0",
            ),
            style: floatingStyles, // 包含 position / top / left / maxWidth
          })}
        >
          {preview}
        </span>
      </FloatingPortal>
    </>
  );
}
