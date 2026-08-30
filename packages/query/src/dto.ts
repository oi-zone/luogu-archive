import type { Article, Forum, Paste, Post, ProblemSummary } from "@lgjs/types";

export interface PublicUserPreviewDto {
  uid: number;
  name: string;
  avatar: string;
  badge: string | null;
  color: string;
  ccfLevel: number;
  xcpcLevel: number;
}

export type ProblemDto = Omit<ProblemSummary, "type">;

export interface ForumDto extends Pick<Forum, "name" | "slug"> {
  problem: ProblemDto | null;
}

export interface PostEntryPreviewDto extends Pick<
  Post,
  "id" | "title" | "time" | "replyCount"
> {
  author: PublicUserPreviewDto;
  forum: ForumDto;
  preview: string;

  savedReplyCount: number;
  snapshotCount: number;
}

export interface ArticleEntryPreviewDto extends Pick<
  Article,
  "lid" | "title" | "time" | "upvote" | "replyCount" | "favorCount" | "category"
> {
  author: PublicUserPreviewDto;
  preview: string;

  savedReplyCount: number;
  snapshotCount: number;
  summary?: string | null;
  tags?: string[] | null;
}

export interface PasteEntryPreviewDto extends Pick<Paste, "id" | "time"> {
  user: PublicUserPreviewDto;
  preview: string;

  snapshotCount: number;
}

export type EntryPreviewDto =
  | PostEntryPreviewDto
  | ArticleEntryPreviewDto
  | PasteEntryPreviewDto
  | PublicUserPreviewDto
  | ProblemDto;
