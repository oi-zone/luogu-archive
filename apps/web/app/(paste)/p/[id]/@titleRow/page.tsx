import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BreadcrumbSetter } from "@/components/layout/breadcrumb-context";

import { getPasteData } from "../data-cache";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = (await params).id;

  const paste = await getPasteData(id);

  if (paste === null) {
    return {
      title: `云剪贴板似乎飘走了`,
    };
  }

  return {
    title: `云剪贴板 ${paste.id}`,
  };
}

export default async function Page({ params }: Props) {
  const id = (await params).id;

  const paste = await getPasteData(id);

  if (paste === null) notFound();

  return (
    <div>
      <BreadcrumbSetter
        trail={[
          { label: "首页", href: "/" },
          { label: "云剪贴板" },
          { label: paste.id, href: `/p/${paste.id}` },
        ]}
      />
      <p className="text-sm font-medium text-muted-foreground">云剪贴板</p>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        云剪贴板 {paste.id}
      </h1>
    </div>
  );
}
