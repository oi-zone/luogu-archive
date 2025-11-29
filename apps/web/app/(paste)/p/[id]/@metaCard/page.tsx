import { getPasteData } from "../data-cache";
import MetaRow from "../meta-row";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = (await params).id;

  const paste = await getPasteData(id);

  return (
    <>
      <div className="mb-2.5">
        <p className="text-sm font-medium text-muted-foreground">云剪贴板</p>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {paste.id.toUpperCase()}
        </h1>
      </div>
      <MetaRow paste={paste} compact />
    </>
  );
}
