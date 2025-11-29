import { cache } from "react";

import { getPostWithSnapshot } from "@luogu-discussion-archive/query";

export const getDiscussionData = cache(async (id: number, snapshot?: Date) => {
  const discussionWithSnapshot = await getPostWithSnapshot(id, snapshot);

  console.log(discussionWithSnapshot);

  if (discussionWithSnapshot === null) {
    throw new Error("Discussion not found");
  }

  if (discussionWithSnapshot.takedown?.length) {
    throw new Error("Discussion taken down");
  }

  return {
    id,
    time: discussionWithSnapshot.time,
    replyCount: discussionWithSnapshot.replyCount,
    title: discussionWithSnapshot.snapshots[0].title,
    content: discussionWithSnapshot.snapshots[0].content,
    capturedAt: discussionWithSnapshot.snapshots[0].capturedAt,
    lastSeenAt: discussionWithSnapshot.snapshots[0].lastSeenAt,
    forum: discussionWithSnapshot.snapshots[0].forum,
    author: {
      id: discussionWithSnapshot.snapshots[0].authorId,
      name: discussionWithSnapshot.snapshots[0].author.snapshots[0].name,
      badge: discussionWithSnapshot.snapshots[0].author.snapshots[0].badge,
      color: discussionWithSnapshot.snapshots[0].author.snapshots[0].color,
      ccfLevel:
        discussionWithSnapshot.snapshots[0].author.snapshots[0].ccfLevel,
      xcpcLevel:
        discussionWithSnapshot.snapshots[0].author.snapshots[0].xcpcLevel,
    },
    snapshotsCount: discussionWithSnapshot._count.snapshots,
    allRepliesCount: discussionWithSnapshot._count.replies,
    allParticipantsCount:
      discussionWithSnapshot._replyParticipantCount +
      (discussionWithSnapshot._authorHasReplied ? 0 : 1),
  };
});
