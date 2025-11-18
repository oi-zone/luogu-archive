import { getArticleBasicInfo } from "@luogu-discussion-archive/query";

import ArticleComments from "../article-comments";

export default async function Layout({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const article = await getArticleBasicInfo(id);

  return (
    <ArticleComments
      article={{
        id: article.lid,
        authorId: article.authorId,
        allCommentsCount: article._count.replies,
      }}
    />
  );
}
