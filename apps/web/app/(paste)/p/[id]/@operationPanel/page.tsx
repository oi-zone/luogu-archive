import { notFound } from "next/navigation";

import { getPasteData } from "../data-cache";
import OperationPanel from "../operation-panel";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = (await params).id;

  const paste = await getPasteData(id);

  if (paste === null) notFound();

  return <OperationPanel paste={paste} />;
}
