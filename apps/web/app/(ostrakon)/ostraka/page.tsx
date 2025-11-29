import { Gavel } from "lucide-react";

import { getGlobalOstrakonPage } from "@luogu-discussion-archive/query";

import { OstrakaTimeline } from "./ostraka-timeline";

export const dynamic = "force-dynamic";

export default async function OstrakaPage() {
  const page = await getGlobalOstrakonPage();

  return (
    <div className="flex flex-1 flex-col gap-8 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-600 dark:text-red-200">
            <Gavel className="size-6" aria-hidden />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              社区守则
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              陶片放逐记录
            </h1>
          </div>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          这里汇总展示最新的社区裁决记录，以倒序实时更新。每次向下滚动会加载 50
          条记录，可使用右侧锚点复制跳转（#ostrakon-xxx）。
        </p>
      </header>

      <OstrakaTimeline
        initialEntries={page.entries}
        initialHasMore={page.hasMore}
        initialCursor={page.nextCursor}
      />
    </div>
  );
}
