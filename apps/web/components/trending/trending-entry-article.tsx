import {
  MessageCircle,
  MessageCircleDashed,
  Star,
  ThumbsUp,
} from "lucide-react";

import { ArticleDto } from "@luogu-discussion-archive/query";

import { getCategoryInfo } from "@/lib/category-info";
import { renderMarkdownToPlainText } from "@/lib/markdown-plain-text";

import TrendingEntryTemplate from "./trending-entry-template";

export default function TrendingEntryArticle({
  article,
}: {
  article: ArticleDto;
}) {
  const rawContent = article.content?.trim() || "";
  const plainContent =
    rawContent.length > 0 ? renderMarkdownToPlainText(rawContent) : "";
  const summary = article.summary?.trim() || "";
  return (
    <TrendingEntryTemplate
      href={`/a/${article.lid}`}
      type="article"
      time={new Date(article.time * 1000)}
      metaTags={[getCategoryInfo(article.category).name]}
      title={article.title}
      content={summary || plainContent}
      contentMaxLines={summary ? undefined : 3}
      tags={article.tags}
      metrics={[
        { icon: MessageCircle, children: `${article.replyCount}\u2009评论` },
        {
          icon: MessageCircleDashed,
          children: `已保存\u2009${article.savedReplyCount}\u2009评论`,
        },
        { icon: Star, children: `${article.favorCount}\u2009收藏` },
        { icon: ThumbsUp, children: `${article.upvote}\u2009赞同` },
      ]}
      user={{ ...article.author, id: article.author.uid }}
    />
  );
}
