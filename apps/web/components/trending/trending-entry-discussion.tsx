import { MessageCircle, MessageCircleDashed } from "lucide-react";

import { PostDto } from "@luogu-discussion-archive/query";

import { renderMarkdownToPlainText } from "@/lib/markdown-plain-text";

import ForumDisplay from "../forum/forum-display";
import TrendingEntryTemplate from "./trending-entry-template";

export default function TrendingEntryDiscussion({
  discussion,
}: {
  discussion: PostDto;
}) {
  const rawContent = discussion.content?.trim() || "";
  const plainContent =
    rawContent.length > 0 ? renderMarkdownToPlainText(rawContent) : "";
  return (
    <TrendingEntryTemplate
      href={`/d/${discussion.id.toString()}`}
      type="discuss"
      time={new Date(discussion.time * 1000)}
      metaTags={[
        <ForumDisplay forum={discussion.forum} key={discussion.forum.slug} />,
      ]}
      title={discussion.title}
      content={plainContent}
      contentMaxLines={3}
      tags={[]}
      metrics={[
        { icon: MessageCircle, children: `${discussion.replyCount}\u2009评论` },
        {
          icon: MessageCircleDashed,
          children: `已保存\u2009${discussion.savedReplyCount}\u2009评论`,
        },
      ]}
      user={{ ...discussion.author, id: discussion.author.uid }}
    />
  );
}
