"use client";

import { FileX } from "lucide-react";

import { NotFoundTemplate } from "@/components/error/not-found-template";
import { BreadcrumbSetter } from "@/components/layout/breadcrumb-context";

export default function NotFound() {
  return (
    <>
      <BreadcrumbSetter
        trail={[{ label: "首页", href: "/" }, { label: "文章" }]}
      />
      <NotFoundTemplate
        Icon={FileX}
        title="文章随风而去了～"
        hint="这篇文章尚未收录、已被删除，或当前不可公开访问。"
      />
    </>
  );
}
