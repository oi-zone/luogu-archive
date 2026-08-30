"use client";

import { MessageSquareX } from "lucide-react";

import { NotFoundTemplate } from "@/components/error/not-found-template";
import { BreadcrumbSetter } from "@/components/layout/breadcrumb-context";

export default function NotFound() {
  return (
    <>
      <BreadcrumbSetter
        trail={[{ label: "首页", href: "/" }, { label: "讨论" }]}
      />
      <NotFoundTemplate
        Icon={MessageSquareX}
        title="掘地三尺也找不到这条帖子！"
        hint="这条讨论尚未收录、已被删除，或当前不可公开访问。"
      />
    </>
  );
}
