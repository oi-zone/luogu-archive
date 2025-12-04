import { Entry } from "@luogu-discussion-archive/query";

import TrendingEntryArticle from "./trending-entry-article";
import TrendingEntryDiscussion from "./trending-entry-discussion";

export default function TrendingEntry({ entry }: { entry: Entry }) {
  if (entry.data === null) return null;

  switch (entry.type) {
    case "article":
      return <TrendingEntryArticle article={entry.data} />;
    case "discuss":
      return <TrendingEntryDiscussion discussion={entry.data} />;
  }
}
