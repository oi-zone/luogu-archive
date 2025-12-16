"use client";

import { BreadcrumbSetter } from "@/components/layout/breadcrumb-context";

import Content from "./content.mdx";

export default function AboutPage() {
  return (
    <>
      <BreadcrumbSetter
        trail={[
          { label: "首页", href: "/" },
          { label: "联系我们", href: "/contact" },
        ]}
      />
      <Content />
    </>
  );
}
