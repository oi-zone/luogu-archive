import React from "react";
import { Calendar, MessageCircle, Tag, Users } from "lucide-react";

import {
  getForumNameFull,
  getForumNameShort,
  type ForumBasicInfo,
} from "@/lib/forum-name";
import { ABSOLUTE_DATE_FORMATTER } from "@/lib/time";
import ForumDisplay, {
  ForumDisplayShort,
} from "@/components/forum/forum-display";
import MetaItem from "@/components/meta/meta-item";
import UserInlineLink, {
  UserBasicInfo,
} from "@/components/user/user-inline-link";

const DiscussionMetaRow = React.forwardRef<
  HTMLDivElement,
  {
    discussion: {
      time: Date;
      forum: ForumBasicInfo;
      author: UserBasicInfo;
      allRepliesCount: number;
      allParticipantsCount: number;
    };
    compact?: boolean;
    className?: string;
  }
>(({ discussion, compact = false, className }, ref) => {
  const publishedAt = React.useMemo(
    () => ABSOLUTE_DATE_FORMATTER.format(discussion.time),
    [discussion.time],
  );

  const metaItems = (
    <>
      <MetaItem icon={Calendar} compact={compact}>
        <time dateTime={discussion.time.toISOString()}>{publishedAt}</time>
      </MetaItem>
      <MetaItem icon={Tag} compact={compact}>
        {compact ? (
          <ForumDisplayShort forum={discussion.forum} />
        ) : (
          <ForumDisplay forum={discussion.forum} />
        )}
      </MetaItem>
      <MetaItem icon={Users} compact={compact}>
        参与者&thinsp;{discussion.allParticipantsCount.toLocaleString("zh-CN")}
      </MetaItem>
      <MetaItem icon={MessageCircle} compact={compact}>
        已保存回复&thinsp;{discussion.allRepliesCount.toLocaleString("zh-CN")}
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
          <UserInlineLink user={discussion.author} />
          {metaItems}
        </>
      ) : (
        <>
          <div className="shrink-0">
            <UserInlineLink user={discussion.author} />
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-right">
            {metaItems}
          </div>
        </>
      )}
    </div>
  );
});
DiscussionMetaRow.displayName = "DiscussionMetaRow";

export default DiscussionMetaRow;
