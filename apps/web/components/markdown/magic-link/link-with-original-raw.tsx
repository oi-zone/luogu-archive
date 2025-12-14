"use client";

import * as React from "react";
import {
  autoUpdate,
  FloatingPortal,
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
  singleLine?: boolean;
};

export default function LinkWithOriginalRaw({
  preview,
  originalRaw,
  className,
  outerClassName,
  singleLine = false,
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
          const maxWidth = Math.min(560, availableWidth);
          const minWidth = Math.min(340, availableWidth);
          Object.assign(elements.floating.style, {
            maxWidth: `${maxWidth}px`,
            minWidth: singleLine ? undefined : `${minWidth}px`,
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
        <div
          // eslint-disable-next-line react-hooks/refs
          ref={refs.setFloating}
          {...getFloatingProps({
            className: cn(
              "pointer-events-none z-50 mt-1 flex w-max rounded-2xl bg-background/60",
              "overflow-hidden",
              "shadow-lg ring-1 ring-border",
              "transition-opacity duration-120",
              open ? "opacity-100" : "opacity-0",
              singleLine
                ? "p-0.75 inline-flex items-center gap-1 backdrop-blur-xs"
                : "p-5 flex-col backdrop-blur-sm",
            ),
            style: floatingStyles, // 包含 position / top / left / maxWidth
          })}
        >
          {preview}
        </div>
      </FloatingPortal>
    </>
  );
}
