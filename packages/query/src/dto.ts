import type {
  Article,
  Forum,
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
}

export interface ArticleDto extends Pick<
  Article,
  "lid" | "title" | "time" | "upvote" | "replyCount" | "favorCount" | "category"
> {
  author: UserDto;
  savedReplyCount: number;

  summary?: string | null;
  tags?: string[] | null;
}
