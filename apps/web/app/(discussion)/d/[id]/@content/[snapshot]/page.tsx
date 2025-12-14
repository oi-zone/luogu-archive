import { notFound } from "next/navigation";

import Markdown from "@/components/markdown/markdown";

import { getDiscussionData } from "../../data-cache";

export default async function Page({
  params,
}: {
  params: Promise<{
    id: string;
    snapshot: string;
  }>;
}) {
  const { id: idStr, snapshot: snapshotStr } = await params;
  const id = parseInt(idStr, 10);
  const snapshot = new Date(parseInt(snapshotStr, 36));

  const discussion = await getDiscussionData(id, snapshot);

  if (discussion === null) notFound();

  return (
    <Markdown originalUrl={`https://www.luogu.com.cn/discuss/${discussion.id}`}>
      {discussion.content}
    </Markdown>
  );
}
