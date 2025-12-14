import { notFound } from "next/navigation";

import { getDiscussionData } from "../../data-cache";
import DiscussionMetaRow from "../../meta-row";

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
