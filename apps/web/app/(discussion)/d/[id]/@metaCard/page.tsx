import { notFound } from "next/navigation";

import { getDiscussionData } from "../data-cache";
import DiscussionMetaRow from "../meta-row";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = parseInt((await params).id, 10);

  const discussion = await getDiscussionData(id);

  if (discussion === null) notFound();

  return (
    <>
      <div className="mb-2.5">
        <p className="text-sm font-medium text-muted-foreground">社区讨论</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {discussion.title}
        </h1>
      </div>
      <DiscussionMetaRow discussion={discussion} compact />
    </>
  );
}
