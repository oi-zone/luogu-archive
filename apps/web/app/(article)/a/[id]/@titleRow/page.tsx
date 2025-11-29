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
      <p className="text-sm font-medium text-muted-foreground">专栏文章</p>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {article.title}
      </h1>
    </div>
  );
}
