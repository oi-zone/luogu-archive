"use client";

import { ClipboardX } from "lucide-react";

import { NotFoundTemplate } from "@/components/error/not-found-template";
import { BreadcrumbSetter } from "@/components/layout/breadcrumb-context";

export default function NotFound() {
  return (
    <>
      <BreadcrumbSetter
        trail={[{ label: "首页", href: "/" }, { label: "云剪贴板" }]}
      />
      <NotFoundTemplate
        Icon={ClipboardX}
        title="云剪贴板似乎飘走了？"
        hint="这份云剪贴板尚未收录、已被删除，或当前不是公开内容。"
      />
    </>
  );
}
