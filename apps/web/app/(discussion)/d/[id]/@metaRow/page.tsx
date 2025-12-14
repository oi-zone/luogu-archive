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

  return <DiscussionMetaRow discussion={discussion} />;
}
