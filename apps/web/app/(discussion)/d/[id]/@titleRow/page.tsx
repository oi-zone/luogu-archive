import { getDiscussionData } from "../data-cache";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = parseInt((await params).id, 10);

  const discussion = await getDiscussionData(id);

  return (
    <div>
      <p className="text-muted-foreground text-sm font-medium">社区讨论</p>
      <h1 className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
        {discussion.title}
      </h1>
    </div>
  );
}
