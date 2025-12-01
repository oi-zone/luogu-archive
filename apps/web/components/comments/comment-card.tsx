import { Camera, ClipboardCheck, ClipboardCopy } from "lucide-react";

import { formatRelativeTime } from "@/lib/time";
import { useClipboard } from "@/hooks/use-clipboard";
import UserInlineLink, {
  UserBasicInfo,
} from "@/components/user/user-inline-link";

import Markdown, {
  type MarkdownDiscussionMentionContext,
} from "../markdown/markdown";
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
  const { copy, copied } = useClipboard();

  const mentionContext: MarkdownDiscussionMentionContext | undefined =
    comment.type === "discussionReply"
      ? {
          kind: "discussion",
          discussionId: comment.postId,
          relativeReplyId: comment.id,
        }
      : undefined;

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
              size="md"
            >
              楼主
            </Badge>
          )}
          {isFromArticleAuthor && (
            <Badge
              className="text-inverse bg-pink-500 dark:bg-pink-400"
              size="md"
            >
              作者
            </Badge>
          )}
          {isPinned && (
            <Badge
              className="bg-amber-500/80 text-amber-950 dark:text-amber-100"
              size="md"
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
      <div className="comment-card group/comment-card relative mt-1.5 rounded-2xl border border-muted/75 bg-muted/75">
        <div className="m-3 leading-relaxed sm:m-3.5">
          <Markdown
            originalUrl={
              comment.type === "discussionReply"
                ? `https://www.luogu.com.cn/discuss/${comment.postId}`
                : `https://www.luogu.com.cn/article/${comment.articleId}`
            }
            compact
            mentionContext={mentionContext}
          >
            {comment.content}
          </Markdown>
        </div>
        <span className="comment-card-footer pointer-events-none absolute -bottom-4 left-1 z-1 opacity-0 transition-opacity duration-150 group-focus-within/comment-card:pointer-events-auto group-focus-within/comment-card:opacity-100 group-hover/comment-card:pointer-events-auto group-hover/comment-card:opacity-100 sm:left-1.5">
          <button
            className="relative top-0 inline-flex cursor-pointer items-center gap-1 rounded-full bg-background/50 px-2.5 py-1.5 text-xs text-muted-foreground shadow-lg ring-1 ring-border backdrop-blur-xs transition-[color,top] duration-200 select-none hover:-top-0.25 hover:text-foreground"
            onClick={() => copy(comment.content)}
            aria-live="polite"
          >
            {copied ? (
              <ClipboardCheck className="inline-block size-3.5" />
            ) : (
              <ClipboardCopy className="inline-block size-3.5" />
            )}
            复制&thinsp;Markdown
          </button>
        </span>
        <span className="comment-card-footer pointer-events-none absolute right-1 -bottom-4 rounded-full bg-background/50 px-2.5 py-1.5 text-xs text-muted-foreground opacity-0 shadow-lg ring-1 ring-border backdrop-blur-xs transition-opacity duration-150 group-focus-within/comment-card:pointer-events-auto group-focus-within/comment-card:opacity-100 group-hover/comment-card:pointer-events-auto group-hover/comment-card:opacity-100 sm:right-1.5">
          {comment.type === "discussionReply"
            ? `#reply-${comment.id}@${comment.capturedAt.getTime().toString(36)}`
            : `#comment-${comment.id}`}
        </span>
      </div>
    </article>
  );
}
