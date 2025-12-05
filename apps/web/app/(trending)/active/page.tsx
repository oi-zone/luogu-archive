import {
  getActiveEntries,
  resolveEntries,
} from "@luogu-discussion-archive/query";

import Container from "@/components/layout/container";
import TrendingEntry from "@/components/trending/trending-entry";

import ActiveUsers from "../active-users";

export const dynamic = "force-dynamic";

export default async function Page() {
  const entries = await resolveEntries(await getActiveEntries());

  return (
    <Container>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,8fr)_minmax(0,3.5fr)] xl:grid-cols-[minmax(0,8fr)_minmax(0,3fr)] 2xl:grid-cols-[minmax(0,3fr)_minmax(0,8fr)_minmax(0,3fr)]">
        <aside className="hidden 2xl:flex 2xl:flex-col 2xl:gap-4">
          这边或许可以放筛选条件之类的
        </aside>
        <main className="order-1 flex flex-col gap-8 2xl:order-2">
          <div className="space-y-5">
            {entries.map((entry) => (
              <div key={entry.type + "-" + entry.id}>
                <TrendingEntry entry={entry} />
              </div>
            ))}
          </div>
        </main>
        <aside className="order-2 hidden lg:order-2 lg:block 2xl:order-3">
          <ActiveUsers />
        </aside>
      </div>
    </Container>
  );
}
