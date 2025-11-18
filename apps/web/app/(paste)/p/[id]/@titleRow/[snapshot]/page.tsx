import { getPasteData } from "../../data-cache";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; snapshot: string }>;
}) {
  const { id, snapshot: snapshotStr } = await params;
  const snapshot = new Date(parseInt(snapshotStr, 36));

  const paste = await getPasteData(id, snapshot);

  return (
    <div>
      <p className="text-muted-foreground text-sm font-medium">云剪贴板</p>
      <h1 className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
        云剪贴板&thinsp;{paste.id.toUpperCase()}@
        {paste.capturedAt.getTime().toString(36).toUpperCase()}
      </h1>
    </div>
  );
}
