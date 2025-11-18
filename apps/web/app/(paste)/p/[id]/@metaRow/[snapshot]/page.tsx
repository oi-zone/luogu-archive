import { getPasteData } from "../../data-cache";
import MetaRow from "../../meta-row";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; snapshot: string }>;
}) {
  const { id, snapshot: snapshotStr } = await params;
  const snapshot = new Date(parseInt(snapshotStr, 36));

  const paste = await getPasteData(id, snapshot);

  return <MetaRow paste={paste} />;
}
