import { notFound } from "next/navigation";

import { getArticleData } from "../../data-cache";
import ArticleMetaRow from "../../meta-row";

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

  if (article === null) notFound();

  return (
    <>
      <div className="mb-2.5">
        <p className="text-sm font-medium text-muted-foreground">专栏文章</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {article.title}
        </h1>
      </div>
      <ArticleMetaRow article={article} compact />
    </>
  );
}
