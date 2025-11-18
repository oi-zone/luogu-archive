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
      <p className="text-muted-foreground text-sm font-medium">专栏文章</p>
      <h1 className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
        {article.title}
      </h1>
    </div>
  );
}
