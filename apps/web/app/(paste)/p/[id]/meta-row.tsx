import React from "react";
import { Calendar } from "lucide-react";

import { ABSOLUTE_DATE_FORMATTER } from "@/lib/feed-data";
import MetaItem from "@/components/meta/meta-item";
import UserInlineLink, {
  UserBasicInfo,
} from "@/components/user/user-inline-link";

const PasteMetaRow = React.forwardRef<
  HTMLDivElement,
  {
    paste: {
      time: Date;
      author: UserBasicInfo;
      public: boolean;
    };
    compact?: boolean;
    className?: string;
  }
>(({ paste, compact = false, className }, ref) => {
  const publishedAt = React.useMemo(
    () => ABSOLUTE_DATE_FORMATTER.format(paste.time),
    [paste.time],
  );

  const metaItems = (
    <>
      <MetaItem icon={Calendar} compact={compact}>
        <time dateTime={paste.time.toISOString()}>{publishedAt}</time>
      </MetaItem>
      <MetaItem compact={compact}>{paste.public ? "公开" : "私密"}</MetaItem>
    </>
  );

  const baseClass =
    "flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground text-sm";
  const wrapperClass = `${baseClass}${compact ? "" : " w-full"}${className ? ` ${className}` : ""}`;

  return (
    <div ref={ref} className={wrapperClass}>
      {compact ? (
        <>
          <UserInlineLink user={paste.author} />
          {metaItems}
        </>
      ) : (
        <>
          <div className="shrink-0">
            <UserInlineLink user={paste.author} />
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-right">
            {metaItems}
          </div>
        </>
      )}
    </div>
  );
});
PasteMetaRow.displayName = "PasteMetaRow";

export default PasteMetaRow;
