import { notFound } from "next/navigation";

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

  if (paste === null) notFound();

  return (
    <>
      <div className="mb-2.5">
        <p className="text-sm font-medium text-muted-foreground">云剪贴板</p>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {paste.id.toUpperCase()}@
          {paste.capturedAt.getTime().toString(36).toUpperCase()}
        </h1>
      </div>
      <MetaRow paste={paste} compact />
    </>
  );
}
