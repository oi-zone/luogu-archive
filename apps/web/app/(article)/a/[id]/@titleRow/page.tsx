import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BreadcrumbSetter } from "@/components/layout/breadcrumb-context";

import { getArticleData } from "../data-cache";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = (await params).id;
  const article = await getArticleData(id);

  if (article === null) {
    return {
      title: `文章随风而去了`,
    };
  }

  return {
    title: article.title,
  };
}

export default async function Page({ params }: Props) {
  const id = (await params).id;
  const article = await getArticleData(id);

  if (article === null) notFound();

  return (
    <div>
      <BreadcrumbSetter
        trail={[
          { label: "首页", href: "/" },
          { label: "文章" },
          { label: article.title, href: `/a/${article.lid}` },
        ]}
      />
      <p className="text-sm font-medium text-muted-foreground">专栏文章</p>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {article.title}
      </h1>
    </div>
  );
}
