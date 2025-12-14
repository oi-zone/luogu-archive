import { notFound } from "next/navigation";

import { getPasteData } from "../../data-cache";
import OperationPanel from "../../operation-panel";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; snapshot: string }>;
}) {
  const { id, snapshot: snapshotStr } = await params;
  const snapshot = new Date(parseInt(snapshotStr, 36));

  const paste = await getPasteData(id, snapshot);

  if (paste === null) notFound();

  return <OperationPanel paste={paste} />;
}
