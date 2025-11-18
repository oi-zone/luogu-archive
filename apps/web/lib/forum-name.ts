export type ForumBasicInfo = {
  slug: string;
  name: string;
  problemId: string | null;
};

export function getForumNameFull(forum: ForumBasicInfo): string {
  return forum.name;
}

export function getForumNameShort(forum: ForumBasicInfo): string {
  return forum.problemId ?? forum.name;
}
