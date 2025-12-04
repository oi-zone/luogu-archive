import { getHotEntries, resolveEntries } from "@luogu-discussion-archive/query";

import Container from "@/components/layout/container";
import TrendingEntry from "@/components/trending/trending-entry";

export const dynamic = "force-dynamic";

export default async function Page() {
  const entries = await resolveEntries(await getHotEntries());
  return (
    <Container>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,8fr)_minmax(0,1.75fr)] xl:grid-cols-[minmax(0,1.5fr)_minmax(0,8fr)_minmax(0,1.5fr)] 2xl:grid-cols-[minmax(0,3fr)_minmax(0,8fr)_minmax(0,3fr)]">
        <aside className="2xl:flex 2xl:flex-col 2xl:gap-4"></aside>
        <main className="order-1 flex flex-col gap-8 2xl:order-2">
          <div className="space-y-5">
            {entries.map((entry) => (
              <div key={entry.type + "-" + entry.id}>
                <TrendingEntry entry={entry} />
              </div>
            ))}
          </div>
        </main>
        <aside className="order-2 lg:order-2 lg:block 2xl:order-3"></aside>
      </div>
    </Container>
  );
}
