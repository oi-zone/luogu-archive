import Markdown from "@/components/markdown/markdown";

import { getArticleData } from "../data-cache";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = (await params).id;

  const article = await getArticleData(id);

  return (
    <Markdown
      originalUrl={`https://www.luogu.com.cn/article/${article.lid}`}
      enableHeadingAnchors
    >
      {article.content}
    </Markdown>
  );
}
