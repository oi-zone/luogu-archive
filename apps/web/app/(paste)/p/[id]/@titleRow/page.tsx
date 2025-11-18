import { getPasteData } from "../data-cache";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = (await params).id;

  const paste = await getPasteData(id);

  return (
    <div>
      <p className="text-muted-foreground text-sm font-medium">云剪贴板</p>
      <h1 className="text-foreground text-2xl font-semibold tracking-tight">
        云剪贴板&thinsp;{paste.id.toUpperCase()}
      </h1>
    </div>
  );
}
