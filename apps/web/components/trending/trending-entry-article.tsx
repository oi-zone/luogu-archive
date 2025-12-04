import {
  MessageCircle,
  MessageCircleDashed,
  Star,
  ThumbsUp,
} from "lucide-react";

import { ArticleDto } from "@luogu-discussion-archive/query";

import { getCategoryInfo } from "@/lib/category-info";

import TrendingEntryTemplate from "./trending-entry-template";

const FALLBACK_ARTICLE_SUMMARY =
  "海内存知己，天涯若比邻。该文章的摘要暂时不可用，请点击查看全文。";

export default function TrendingEntryArticle({
  article,
}: {
  article: ArticleDto;
}) {
  return (
    <TrendingEntryTemplate
      href={`/a/${article.lid}`}
      type="article"
      time={new Date(article.time * 1000)}
      metaTags={[getCategoryInfo(article.category).name]}
      title={article.title}
      content={article.summary?.trim() || FALLBACK_ARTICLE_SUMMARY}
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
