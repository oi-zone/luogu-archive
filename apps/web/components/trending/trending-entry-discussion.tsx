import { MessageCircle, MessageCircleDashed } from "lucide-react";

import { PostDto } from "@luogu-discussion-archive/query";

import ForumDisplay from "../forum/forum-display";
import TrendingEntryTemplate from "./trending-entry-template";

const FALLBACK_DISCUSSION_SUMMARY =
  "野火烧不尽，春风吹又生。该讨论的摘要暂时不可用，请点击查看全文。";

export default function TrendingEntryDiscussion({
  discussion,
}: {
  discussion: PostDto;
}) {
  return (
    <TrendingEntryTemplate
      href={`/d/${discussion.id.toString()}`}
      type="discuss"
      time={new Date(discussion.time * 1000)}
      metaTags={[
        <ForumDisplay forum={discussion.forum} key={discussion.forum.slug} />,
      ]}
      title={discussion.title}
      content={FALLBACK_DISCUSSION_SUMMARY}
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
