import type { ForumBasicInfo as QueryForumBasicInfo } from "@luogu-discussion-archive/query";

export type ForumBasicInfo = QueryForumBasicInfo;

export function getForumNameFull(forum: ForumBasicInfo): string {
  return forum.name;
}

export function getForumNameShort(forum: ForumBasicInfo): string {
  return forum.problem?.pid ?? forum.problemId ?? forum.name;
}
