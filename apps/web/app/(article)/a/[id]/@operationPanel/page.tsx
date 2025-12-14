import { notFound } from "next/navigation";

import { getArticleData } from "../data-cache";
import ArticleOperationPanel from "../operation-panel";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = (await params).id;

  const article = await getArticleData(id);

  if (article === null) notFound();

  return <ArticleOperationPanel article={article} />;
}
