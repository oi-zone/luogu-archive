"use client";

import { enqueuePasteRefresh } from "@/server-actions/queue-jobs";
import { ClipboardX } from "lucide-react";
import { useParams } from "next/navigation";

import { NotFoundTemplate } from "@/components/error/not-found-template";
import { BreadcrumbSetter } from "@/components/layout/breadcrumb-context";

export default function NotFound() {
  const params = useParams();
  const rawId = params?.id;
  const pasteId = Array.isArray(rawId) ? rawId[0] : rawId;

  const queueJobButtonProps = pasteId
    ? {
        idleText: "尝试保存该云剪贴板",
        pendingText: "正在加入保存队列",
        successText: "保存任务已创建",
        errorText: "任务创建失败，点击重试",
        onTrigger: async () => enqueuePasteRefresh(pasteId),
      }
    : undefined;

  return (
    <>
      <BreadcrumbSetter
        trail={[{ label: "首页", href: "/" }, { label: "云剪贴板" }]}
      />
      <NotFoundTemplate
        Icon={ClipboardX}
        title="云剪贴板似乎飘走了？"
        hint="这份云剪贴板尚未收录或已被删除。如果您希望保存这份云剪贴板，可以尝试点击下方按钮将其加入任务队列。"
        queueJobButtonProps={queueJobButtonProps}
      />
    </>
  );
}
