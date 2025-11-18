import Markdown from "@/components/markdown/markdown";

import { getArticleData } from "../../data-cache";

export default async function Page({
  params,
}: {
  params: Promise<{
    id: string;
    snapshot: string;
  }>;
}) {
  const { id, snapshot: snapshotStr } = await params;
  const snapshot = new Date(parseInt(snapshotStr, 36));

  const article = await getArticleData(id, snapshot);

  return (
    <Markdown
      originalUrl={`https://www.luogu.com.cn/article/${article.lid}`}
      enableHeadingAnchors
    >
      {article.content}
    </Markdown>
  );
}
