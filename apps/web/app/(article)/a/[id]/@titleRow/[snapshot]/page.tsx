import { Badge } from "@/components/ui/badge";
import { BreadcrumbSetter } from "@/components/layout/breadcrumb-context";

import { getArticleData } from "../../data-cache";

export default async function Page({
  params,
}: {
  params: Promise<{
    id: string;
    snapshot: string;
  }>;
}) {
  const { id, snapshot: snapshotStr } = await params;
  const snapshot = new Date(parseInt(snapshotStr, 36));

  const article = await getArticleData(id, snapshot);

  return (
    <div>
      <BreadcrumbSetter
        trail={[
          { label: "首页", href: "/" },
          { label: "文章" },
          {
            label: (
              <>
                <Badge className="relative -top-0.25 me-1 bg-blue-500/10 text-blue-600">
                  快照
                </Badge>
                {article.title}
              </>
            ),
            href: `/a/${article.lid}@${snapshotStr}`,
          },
        ]}
      />
      <p className="text-sm font-medium text-muted-foreground">专栏文章</p>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {article.title}
      </h1>
    </div>
  );
}
