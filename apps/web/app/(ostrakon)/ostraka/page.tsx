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
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-gray-500/10 text-gray-600 dark:text-gray-200">
            <Gavel className="size-6" aria-hidden />
          </span>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">陶片放逐</h1>
          </div>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          陶片放逐制，是古代雅典城邦的一项政治制度，由雅典政治家克里斯提尼于公元前&thinsp;510&thinsp;年创立。
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
