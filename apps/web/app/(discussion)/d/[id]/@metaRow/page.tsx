import { getDiscussionData } from "../data-cache";
import DiscussionMetaRow from "../discussion-meta-row";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = parseInt((await params).id, 10);

  const discussion = await getDiscussionData(id);

  return <DiscussionMetaRow discussion={discussion} />;
}
