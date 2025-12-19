"use client";

import { useParams } from "next/navigation";
import { MessageSquareX } from "lucide-react";

import { NotFoundTemplate } from "@/components/error/not-found-template";
import { BreadcrumbSetter } from "@/components/layout/breadcrumb-context";
import { enqueueDiscussionRefresh } from "@/server-actions/queue-jobs";

export default function NotFound() {
  const params = useParams();
  const rawId = params?.id;
  const idValue = Array.isArray(rawId) ? rawId[0] : rawId;
  const numericId = idValue ? Number.parseInt(String(idValue), 10) : NaN;

  const queueJobButtonProps = Number.isFinite(numericId)
    ? {
        idleText: "尝试保存该讨论",
        pendingText: "正在加入保存队列",
        successText: "保存任务已创建",
        errorText: "任务创建失败，点击重试",
        onTrigger: async () => enqueueDiscussionRefresh(numericId),
      }
    : undefined;

  return (
    <>
      <BreadcrumbSetter
        trail={[{ label: "首页", href: "/" }, { label: "讨论" }]}
      />
      <NotFoundTemplate
        Icon={MessageSquareX}
        title="掘地三尺也找不到这条帖子！"
        hint="这条讨论尚未收录或已被删除。如果您希望保存这条讨论，可以尝试点击下方按钮将其加入任务队列。"
        queueJobButtonProps={queueJobButtonProps}
      />
    </>
  );
}
