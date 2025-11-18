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

  return (
    <div>
      <p className="text-muted-foreground text-sm font-medium">社区讨论</p>
      <h1 className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
        {discussion.title}
      </h1>
    </div>
  );
}
