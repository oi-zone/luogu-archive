import { getFeedPage } from "@luogu-discussion-archive/query";

import { FeedGrid } from "@/components/feed/feed-grid";

export const dynamic = "force-dynamic";

const INITIAL_FEED_LIMIT = 30;

export default async function Page() {
  const initialPage = await getFeedPage({ limit: INITIAL_FEED_LIMIT });

  return (
    <div className="flex flex-1 flex-col gap-8 px-4 pt-8 pb-12 sm:px-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">社区精选</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              实时汇总高热度的文章、帖子、云剪贴板与陶片。
            </p>
          </div>
        </div>
      </div>
      <FeedGrid initialPage={initialPage} />
    </div>
  );
}
