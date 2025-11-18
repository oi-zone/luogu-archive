import Markdown from "@/components/markdown/markdown";

import { getDiscussionData } from "../data-cache";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = parseInt((await params).id, 10);

  const discussion = await getDiscussionData(id);

  return (
    <Markdown originalUrl={`https://www.luogu.com.cn/discuss/${discussion.id}`}>
      {discussion.content}
    </Markdown>
  );
}
