import ArticleMetaRow from "../article-meta-row";
import { getArticleData } from "../data-cache";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = (await params).id;

  const article = await getArticleData(id);

  return <ArticleMetaRow article={article} />;
}
