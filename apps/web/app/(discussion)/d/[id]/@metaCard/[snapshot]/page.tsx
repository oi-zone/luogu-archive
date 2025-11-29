import { getDiscussionData } from "../../data-cache";
import DiscussionMetaRow from "../../discussion-meta-row";

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
  console.log("snapshot", snapshot);

  const discussion = await getDiscussionData(id, snapshot);

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
