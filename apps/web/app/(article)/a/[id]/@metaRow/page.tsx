import { getArticleData } from "../data-cache";
import ArticleMetaRow from "../meta-row";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = (await params).id;

  const article = await getArticleData(id);

  return <ArticleMetaRow article={article} />;
}
