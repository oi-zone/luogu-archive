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

  return <ArticleMetaRow article={article} />;
}
