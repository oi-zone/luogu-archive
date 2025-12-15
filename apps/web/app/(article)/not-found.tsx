"use client";

import { enqueueArticleRefresh } from "@/server-actions/queue-jobs";
import { FileX } from "lucide-react";
import { useParams } from "next/navigation";

import { NotFoundTemplate } from "@/components/error/not-found-template";
import { BreadcrumbSetter } from "@/components/layout/breadcrumb-context";

export default function NotFound() {
  const params = useParams();
  const rawId = params?.id;
  const lid = Array.isArray(rawId) ? rawId[0] : rawId;

  const queueJobButtonProps = lid
    ? {
        idleText: "尝试保存该文章",
        pendingText: "正在加入保存队列",
        successText: "保存任务已创建",
        errorText: "任务创建失败，点击重试",
        onTrigger: async () => enqueueArticleRefresh(lid),
      }
    : undefined;

  return (
    <>
      <BreadcrumbSetter
        trail={[{ label: "首页", href: "/" }, { label: "文章" }]}
      />
      <NotFoundTemplate
        Icon={FileX}
        title="文章随风而去了～"
        hint="这篇文章尚未收录或已被删除。如果您希望保存这篇文章，可以尝试点击下方按钮将其加入任务队列。"
        queueJobButtonProps={queueJobButtonProps}
      />
    </>
  );
}
