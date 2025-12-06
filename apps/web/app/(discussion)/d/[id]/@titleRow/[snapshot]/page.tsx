import { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { BreadcrumbSetter } from "@/components/layout/breadcrumb-context";

import { getDiscussionData } from "../../data-cache";

type Props = {
  params: Promise<{
    id: string;
    snapshot: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id: idStr, snapshot: snapshotStr } = await params;
  const id = parseInt(idStr, 10);
  const snapshot = new Date(parseInt(snapshotStr, 36));

  const discussion = await getDiscussionData(id, snapshot);

  return {
    title: `[快照] ${discussion.title}`,
  };
}

export default async function Page({ params }: Props) {
  const { id: idStr, snapshot: snapshotStr } = await params;
  const id = parseInt(idStr, 10);
  const snapshot = new Date(parseInt(snapshotStr, 36));

  const discussion = await getDiscussionData(id, snapshot);

  return (
    <div>
      <BreadcrumbSetter
        trail={[
          { label: "首页", href: "/" },
          { label: "讨论" },
          {
            label: (
              <>
                <Badge className="relative -top-0.25 me-1 bg-blue-500/10 text-blue-600">
                  快照
                </Badge>
                {discussion.title}
              </>
            ),
            href: `/d/${discussion.id}@${snapshotStr}`,
          },
        ]}
      />
      <p className="text-sm font-medium text-muted-foreground">社区讨论</p>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {discussion.title}
      </h1>
    </div>
  );
}
