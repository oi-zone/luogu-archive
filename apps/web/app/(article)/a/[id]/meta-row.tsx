import React from "react";
import { Calendar, MessageCircle, Swords, Tag, Users } from "lucide-react";

import { getCategoryInfo } from "@/lib/category-info";
import { ABSOLUTE_DATE_FORMATTER } from "@/lib/time";
import MetaItem from "@/components/meta/meta-item";
import UserInlineLink, {
  UserBasicInfo,
} from "@/components/user/user-inline-link";

const ArticleMetaRow = React.forwardRef<
  HTMLDivElement,
  {
    article: {
      time: Date;
      collection: {
        id: number;
        name: string;
      } | null;
      category: number;
      solutionFor: {
        title: string;
        pid: string;
        difficulty: number | null;
      } | null;
      author: UserBasicInfo;
      allRepliesCount: number;
      allParticipantsCount: number;
    };
    compact?: boolean;
    className?: string;
  }
>(({ article, compact = false, className }, ref) => {
  const publishedAt = React.useMemo(
    () => ABSOLUTE_DATE_FORMATTER.format(article.time),
    [article.time],
  );

  const metaItems = (
    <>
      <MetaItem icon={Calendar} compact={compact}>
        <time dateTime={article.time.toISOString()}>{publishedAt}</time>
      </MetaItem>
      {article.solutionFor && (
        <MetaItem icon={Swords} compact={compact}>
          {article.solutionFor.pid}
        </MetaItem>
      )}
      <MetaItem icon={Tag} compact={compact}>
        {getCategoryInfo(article.category).name}
      </MetaItem>
      <MetaItem icon={Users} compact={compact}>
        参与者&thinsp;{article.allParticipantsCount.toLocaleString("zh-CN")}
      </MetaItem>
      <MetaItem icon={MessageCircle} compact={compact}>
        已保存评论&thinsp;{article.allRepliesCount.toLocaleString("zh-CN")}
      </MetaItem>
    </>
  );

  const baseClass =
    "flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground text-sm";
  const wrapperClass = `${baseClass}${compact ? "" : " w-full"}${className ? ` ${className}` : ""}`;

  return (
    <div ref={ref} className={wrapperClass}>
      {compact ? (
        <>
          <UserInlineLink user={article.author} />
          {metaItems}
        </>
      ) : (
        <>
          <div className="shrink-0">
            <UserInlineLink user={article.author} />
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-right">
            {metaItems}
          </div>
        </>
      )}
    </div>
  );
});
ArticleMetaRow.displayName = "ArticleMetaRow";

export default ArticleMetaRow;
