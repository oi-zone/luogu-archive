import { getDiscussionData } from "../data-cache";
import DiscussionMetaRow from "../discussion-meta-row";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = parseInt((await params).id, 10);

  const discussion = await getDiscussionData(id);

  return (
    <>
      <div className="mb-2.5">
        <p className="text-muted-foreground text-sm font-medium">社区讨论</p>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          {discussion.title}
        </h1>
      </div>
      <DiscussionMetaRow discussion={discussion} compact />
    </>
  );
}
