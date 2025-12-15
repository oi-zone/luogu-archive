import { Metadata } from "next";
import { notFound } from "next/navigation";

import { BreadcrumbSetter } from "@/components/layout/breadcrumb-context";

import { getDiscussionData } from "../data-cache";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = parseInt((await params).id, 10);
  const discussion = await getDiscussionData(id);

  if (discussion === null) {
    return {
      title: `帖子掘地三尺找不到`,
    };
  }

  return {
    title: discussion.title,
  };
}

export default async function Page({ params }: Props) {
  const id = parseInt((await params).id, 10);

  const discussion = await getDiscussionData(id);

  if (discussion === null) notFound();

  return (
    <div>
      <BreadcrumbSetter
        trail={[
          { label: "首页", href: "/" },
          { label: "讨论" },
          { label: discussion.title, href: `/d/${discussion.id}` },
        ]}
      />
      <p className="text-sm font-medium text-muted-foreground">社区讨论</p>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {discussion.title}
      </h1>
    </div>
  );
}
