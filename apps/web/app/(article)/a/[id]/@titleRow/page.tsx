import { BreadcrumbSetter } from "@/components/layout/breadcrumb-context";

import { getArticleData } from "../data-cache";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = (await params).id;

  const article = await getArticleData(id);

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
