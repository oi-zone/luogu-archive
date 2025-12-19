import { Suspense } from "react";

import {
  getActiveEntries,
  resolveEntries,
} from "@luogu-discussion-archive/query";

import { BreadcrumbSetter } from "@/components/layout/breadcrumb-context";
import Container from "@/components/layout/container";
import TrendingEntry from "@/components/trending/trending-entry";

import ActiveUsers from "../active-users";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "探索",
};

export default function Page() {
  return (
    <Container>
      <BreadcrumbSetter
        trail={[
          { label: "首页", href: "/" },
          { label: "探索", href: "/explore" },
        ]}
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,8fr)_minmax(0,3.5fr)] xl:grid-cols-[minmax(0,8fr)_minmax(0,3fr)] 2xl:grid-cols-[minmax(0,3fr)_minmax(0,8fr)_minmax(0,3fr)]">
        <aside className="hidden 2xl:flex 2xl:flex-col"></aside>
        <main className="order-1 flex flex-col gap-8 2xl:order-2">
          <Suspense>
            <ActiveEntries />
          </Suspense>
        </main>
        <aside className="order-2 hidden lg:order-2 lg:block 2xl:order-3">
          <Suspense>
            <ActiveUsers />
          </Suspense>
        </aside>
      </div>
    </Container>
  );
}

async function ActiveEntries() {
  const entries = await resolveEntries(await getActiveEntries());

  return (
    <div className="space-y-5">
      {entries.map((entry) => (
        <div key={entry.type + "-" + entry.id}>
          <TrendingEntry entry={entry} />
        </div>
      ))}
    </div>
  );
}
