import ArticleMetaRow from "../article-meta-row";
import { getArticleData } from "../data-cache";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = (await params).id;

  const article = await getArticleData(id);

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
