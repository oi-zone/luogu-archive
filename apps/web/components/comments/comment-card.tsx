import { Camera, ClipboardCopy } from "lucide-react";

import { formatRelativeTime } from "@/lib/feed-data";
import { useClipboard } from "@/hooks/use-clipboard";
import UserInlineLink, {
  UserBasicInfo,
} from "@/components/user/user-inline-link";

import Markdown from "../markdown/markdown";
import MetaItem from "../meta/meta-item";
import { Badge } from "../ui/badge";

export type DiscussionReply = {
  type: "discussionReply";
  postId: number;
  id: number;
  time: Date;
  content: string;
  capturedAt: Date;
  lastSeenAt: Date;
  author: UserBasicInfo;
  snapshotsCount: number;
};

export type ArticleComment = {
  type: "articleComment";
  articleId: string;
  id: number;
  time: Date;
  content: string;
  updatedAt: Date;
  author: UserBasicInfo;
};

export type CommentCardProps = {
  comment: DiscussionReply | ArticleComment;
  isFromDiscussionAuthor: boolean;
  isFromArticleAuthor: boolean;
  isPinned: boolean;
};

export function CommentCard({
  comment,
  isFromDiscussionAuthor = false,
  isFromArticleAuthor = false,
  isPinned = false,
}: CommentCardProps) {
  const { copy } = useClipboard();

  return (
    <article
      className=""
      id={`${comment.type === "discussionReply" ? "reply" : "comment"}-${comment.id}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <UserInlineLink user={comment.author} />
          {isFromDiscussionAuthor && (
            <Badge
              className="text-inverse bg-pink-500 dark:bg-pink-400"
              size="lg"
            >
              楼主
            </Badge>
          )}
          {isFromArticleAuthor && (
            <Badge
              className="text-inverse bg-pink-500 dark:bg-pink-400"
              size="lg"
            >
              作者
            </Badge>
          )}
          {isPinned && (
            <Badge
              className="bg-amber-500/80 text-amber-950 dark:text-amber-100"
              size="lg"
            >
              置顶
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <MetaItem>{formatRelativeTime(comment.time)}</MetaItem>
          {comment.type === "discussionReply" && (
            <MetaItem icon={Camera}>
              快照&thinsp;{comment.snapshotsCount.toLocaleString("zh-CN")}
              &thinsp;份
            </MetaItem>
          )}
        </div>
      </header>
      <div className="mt-1.5 rounded-2xl border border-border bg-background/80 shadow-sm sm:ms-4">
        <div className="mx-3 mt-3.5 mb-3 leading-relaxed sm:mx-4">
          <Markdown
            originalUrl={
              comment.type === "discussionReply"
                ? `https://www.luogu.com.cn/discuss/${comment.postId}`
                : `https://www.luogu.com.cn/article/${comment.articleId}`
            }
            compact
          >
            {comment.content}
          </Markdown>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 rounded-b-2xl bg-muted px-3 py-1 sm:px-4">
          <button
            className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground transition-colors duration-200 select-none hover:text-foreground"
            onClick={() => copy(comment.content)}
            aria-live="polite"
          >
            <ClipboardCopy className="inline-block size-3.5" />
            复制&thinsp;Markdown
          </button>
          <div>
            {comment.type === "discussionReply" ? (
              <span className="text-xs text-muted-foreground">
                #reply-{comment.id}@{comment.capturedAt.getTime().toString(36)}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                #comment-{comment.id}
              </span>
            )}
          </div>
        </footer>
      </div>
    </article>
  );
}
