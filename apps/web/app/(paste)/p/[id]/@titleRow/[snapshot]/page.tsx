import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { BreadcrumbSetter } from "@/components/layout/breadcrumb-context";

import { getPasteData } from "../../data-cache";

type Props = {
  params: Promise<{
    id: string;
    snapshot: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, snapshot: snapshotStr } = await params;
  const snapshot = new Date(parseInt(snapshotStr, 36));

  const paste = await getPasteData(id, snapshot);

  return {
    title: `[快照] 云剪贴板 ${paste.id}`,
  };
}

export default async function Page({ params }: Props) {
  const { id, snapshot: snapshotStr } = await params;
  const snapshot = new Date(parseInt(snapshotStr, 36));

  const paste = await getPasteData(id, snapshot);

  return (
    <div>
      <BreadcrumbSetter
        trail={[
          { label: "首页", href: "/" },
          { label: "云剪贴板" },
          {
            label: (
              <>
                <Badge className="relative -top-0.25 me-1 bg-blue-500/10 text-blue-600">
                  快照
                </Badge>
                {paste.id}
              </>
            ),
            href: `/p/${paste.id}@${snapshotStr}`,
          },
        ]}
      />
      <p className="text-sm font-medium text-muted-foreground">云剪贴板</p>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        云剪贴板 {paste.id}
      </h1>
    </div>
  );
}
