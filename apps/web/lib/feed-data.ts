export type FeedItemType = "article" | "discussion" | "status";

export type FeedAuthor = {
  id: number;
  username: string;
  name: string;
  color: string;
  badge: string | null;
  ccfLevel: number;
  xcpcLevel: number;
  avatarUrl: string;
};

export type ArticleFeedItem = {
  id: string;
  type: "article";
  title: string;
  summary: string;
  replies: number;
  views: number;
  author: FeedAuthor;
  publishedAt: Date;
};

export type DiscussionFeedItem = {
  id: string;
  type: "discussion";
  title: string;
  summary: string;
  replies: number;
  views: number;
  author: FeedAuthor;
  publishedAt: Date;
};

export type StatusFeedItem = {
  id: string;
  type: "status";
  content: string;
  author: FeedAuthor;
  publishedAt: Date;
};

export type FeedItem = ArticleFeedItem | DiscussionFeedItem | StatusFeedItem;

export const TYPE_LABEL: Record<FeedItemType, string> = {
  article: "文章",
  discussion: "讨论",
  status: "动态",
};

export const TYPE_BADGE_CLASS: Record<FeedItemType, string> = {
  article: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  discussion: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  status: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
};
