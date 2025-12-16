import type {
  Article,
  Forum,
  Paste,
  Post,
  ProblemSummary,
  UserSummary,
} from "@lgjs/types";

export type UserDto = Omit<UserSummary, "isRoot">;

export type ProblemDto = Omit<ProblemSummary, "type">;

export interface ForumDto extends Pick<Forum, "name" | "slug"> {
  problem: ProblemDto | null;
}

export interface PostDto extends Pick<
  Post,
  "id" | "title" | "time" | "replyCount"
> {
  author: UserDto;
  forum: ForumDto;
  content: string;

  savedReplyCount: number;
  snapshotCount: number;
}

export interface ArticleDto extends Pick<
  Article,
  "lid" | "title" | "time" | "upvote" | "replyCount" | "favorCount" | "category"
> {
  author: UserDto;
  content: string;

  savedReplyCount: number;
  snapshotCount: number;
  summary?: string | null;
  tags?: string[] | null;
}

export interface PasteDto extends Pick<
  Paste,
  "data" | "id" | "time" | "public"
> {
  user: UserDto;

  snapshotCount: number;
}
