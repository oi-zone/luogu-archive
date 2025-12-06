import {
  getGlobalOstrakonPage,
  getOstrakonStat,
} from "@luogu-discussion-archive/query";

import { BreadcrumbSetter } from "@/components/layout/breadcrumb-context";
import Container from "@/components/layout/container";

import OperationPanel from "./operation-panel";
import { OstrakaTimeline } from "./ostraka-timeline";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "陶片放逐",
};

export default async function OstrakaPage() {
  const page = await getGlobalOstrakonPage();
  const stat = await getOstrakonStat();

  return (
    <Container>
      <BreadcrumbSetter
        trail={[
          { label: "首页", href: "/" },
          { label: "陶片放逐", href: "/ostraka" },
        ]}
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,8fr)_minmax(0,3.5fr)] xl:grid-cols-[minmax(0,8fr)_minmax(0,3fr)] 2xl:grid-cols-[minmax(0,3fr)_minmax(0,8fr)_minmax(0,3fr)]">
        <aside className="hidden 2xl:flex 2xl:flex-col 2xl:gap-4">
          <header className="sticky top-24.25 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">
                陶片放逐
              </h1>
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              陶片放逐制，是古代雅典城邦的一项政治制度，由雅典政治家克里斯提尼于公元前&thinsp;510&thinsp;年创立。
            </p>
          </header>
        </aside>
        <main className="order-1 flex flex-col gap-8 2xl:order-2">
          <div className="block 2xl:hidden">
            <header className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight">
                  陶片放逐
                </h1>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                陶片放逐制，是古代雅典城邦的一项政治制度，由雅典政治家克里斯提尼于公元前&thinsp;510&thinsp;年创立。
              </p>
            </header>
          </div>
          <OstrakaTimeline
            initialEntries={page.entries}
            initialHasMore={page.hasMore}
            initialCursor={page.nextCursor}
          />
        </main>
        <aside className="order-2 hidden lg:order-2 lg:block 2xl:order-3">
          <div className="sticky top-24.25">
            <OperationPanel stat={stat} />
          </div>
        </aside>
      </div>
    </Container>
  );
}
