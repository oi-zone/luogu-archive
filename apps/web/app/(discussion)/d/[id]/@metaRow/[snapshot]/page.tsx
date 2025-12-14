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

  return <DiscussionMetaRow discussion={discussion} />;
}
