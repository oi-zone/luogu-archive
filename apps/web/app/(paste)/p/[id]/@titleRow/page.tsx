import { BreadcrumbSetter } from "@/components/layout/breadcrumb-context";

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
      <BreadcrumbSetter
        trail={[
          { label: "首页", href: "/" },
          { label: "云剪贴板" },
          { label: paste.id.toUpperCase(), href: `/p/${paste.id}` },
        ]}
      />
      <p className="text-sm font-medium text-muted-foreground">云剪贴板</p>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        云剪贴板&thinsp;{paste.id.toUpperCase()}
      </h1>
    </div>
  );
}
