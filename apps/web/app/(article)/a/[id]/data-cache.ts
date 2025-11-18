import { cache } from "react";

import { getArticleWithSnapshot } from "@luogu-discussion-archive/query";

export const getArticleData = cache(async (lid: string, snapshot?: Date) => {
  const articleWithSnapshot = await getArticleWithSnapshot(lid, snapshot);

  if (articleWithSnapshot === null) {
    throw new Error("Article not found");
  }

  // if (articleWithSnapshot.takedown) {
  //   throw new Error("Article taken down");
  // }

  return {
    lid,
    time: articleWithSnapshot.time,
    replyCount: articleWithSnapshot.replyCount,
    solutionFor: articleWithSnapshot.snapshots[0].solutionFor,
    title: articleWithSnapshot.snapshots[0].title,
    content: articleWithSnapshot.snapshots[0].content,
    capturedAt: articleWithSnapshot.snapshots[0].capturedAt,
    lastSeenAt: articleWithSnapshot.snapshots[0].lastSeenAt,
    category: articleWithSnapshot.snapshots[0].category,
    author: {
      id: articleWithSnapshot.authorId,
      name: articleWithSnapshot.author.snapshots[0].name,
      badge: articleWithSnapshot.author.snapshots[0].badge,
      color: articleWithSnapshot.author.snapshots[0].color,
      ccfLevel: articleWithSnapshot.author.snapshots[0].ccfLevel,
      xcpcLevel: articleWithSnapshot.author.snapshots[0].xcpcLevel,
    },
    collection: articleWithSnapshot.snapshots[0].collection,
    snapshotsCount: articleWithSnapshot._count.snapshots,
    allRepliesCount: articleWithSnapshot._count.replies,
    allParticipantsCount:
      articleWithSnapshot._replyParticipantCount +
      (articleWithSnapshot._authorHasReplied ? 0 : 1),
  };
});
