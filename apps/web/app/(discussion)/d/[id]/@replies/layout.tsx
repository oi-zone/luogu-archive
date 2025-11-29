import { getPostBasicInfo } from "@luogu-discussion-archive/query";

import DiscussionReplies from "../replies";

export default async function Layout({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = parseInt((await params).id, 10);

  const discussion = await getPostBasicInfo(id);

  return (
    <DiscussionReplies
      discussion={{
        id: discussion.id,
        authors: discussion.authors.map((author) => author.id),
        allRepliesCount: discussion._count.replies,
      }}
    />
  );
}
