import { notFound } from "next/navigation";

import { getDiscussionData } from "../data-cache";
import DiscussionOperationPanel from "../operation-panel";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = parseInt((await params).id, 10);

  const discussion = await getDiscussionData(id);

  if (discussion === null) notFound();

  return <DiscussionOperationPanel discussion={discussion} />;
}
