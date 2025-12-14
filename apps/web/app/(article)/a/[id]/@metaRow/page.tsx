import { notFound } from "next/navigation";

import { getArticleData } from "../data-cache";
import ArticleMetaRow from "../meta-row";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = (await params).id;

  const article = await getArticleData(id);

  if (article === null) notFound();

  return <ArticleMetaRow article={article} />;
}
