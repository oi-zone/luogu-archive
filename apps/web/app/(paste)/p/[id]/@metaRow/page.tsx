import { notFound } from "next/navigation";

import { getPasteData } from "../data-cache";
import MetaRow from "../meta-row";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = (await params).id;

  const paste = await getPasteData(id);

  if (paste === null) notFound();

  return <MetaRow paste={paste} />;
}
