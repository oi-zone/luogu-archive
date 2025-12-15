"use client";

import { UserRoundX } from "lucide-react";

import { NotFoundTemplate } from "@/components/error/not-found-template";
import { BreadcrumbSetter } from "@/components/layout/breadcrumb-context";

export default function NotFound() {
  return (
    <>
      <BreadcrumbSetter
        trail={[{ label: "首页", href: "/" }, { label: "用户" }]}
      />
      <NotFoundTemplate
        Icon={UserRoundX}
        title="可恶！这位用户太神秘了！"
        hint="这位用户尚未收录或不存在，目前尚不支持直接保存用户。"
      />
    </>
  );
}
