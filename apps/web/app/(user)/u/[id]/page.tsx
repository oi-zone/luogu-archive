import { getUserProfileBundleCache } from "@/app/(user)/u/[id]/data-cache";
import { Metadata } from "next/dist/lib/metadata/types/metadata-interface";
import { notFound } from "next/navigation";

import { BreadcrumbSetter } from "@/components/layout/breadcrumb-context";
import { UserInfoCard } from "@/components/user/user-info-card";
import { UserRecommendations } from "@/components/user/user-recommendations";

import { UserTimeline } from "./user-timeline";
import { UsernameHistoryCard } from "./username-history-card";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const uid = Number.parseInt(id, 10);
  const data = await getUserProfileBundleCache(uid);
  if (!data) {
    return {
      title: `神秘用户`,
    };
  }

  return {
    title: `@${data.profile.name}`,
  };
}

export default async function UserDetailPage({ params }: Props) {
  const { id } = await params;
  const uid = Number.parseInt(id, 10);
  const data = await getUserProfileBundleCache(uid);
  if (!data) notFound();
  const {
    profile,
    usernameHistory,
    related,
    timeline,
    timelineHasMore,
    timelineNextCursor,
  } = data;
  const breadcrumbs = [
    { label: "首页", href: "/" },
    { label: "用户" },
    { label: `@${profile.name}`, href: `/u/${profile.id}` },
  ];

  return (
    <div className="mx-auto w-full px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <BreadcrumbSetter trail={breadcrumbs} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3.2fr)_minmax(0,8fr)] lg:items-start xl:grid-cols-[minmax(0,2.7fr)_minmax(0,8fr)] 2xl:grid-cols-[minmax(0,2.8fr)_minmax(0,8fr)_minmax(0,3.2fr)]">
        <div className="space-y-4 lg:col-start-1 lg:row-start-1">
          <UserInfoCard profile={profile} />
          <UsernameHistoryCard entries={usernameHistory} />
          <div className="lg:hidden">
            <UserRecommendations users={related} layout="carousel" />
          </div>
          <div className="hidden lg:col-start-1 lg:row-start-2 lg:block 2xl:hidden">
            <UserRecommendations users={related} layout="stacked" />
          </div>
        </div>
        <div className="lg:col-start-2 lg:row-span-2 lg:self-start 2xl:col-start-2 2xl:row-start-1">
          <UserTimeline
            userId={uid}
            initialEntries={timeline}
            initialHasMore={timelineHasMore}
            initialCursor={timelineNextCursor}
          />
        </div>
        <aside className="hidden 2xl:col-start-3 2xl:row-start-1 2xl:block">
          <UserRecommendations users={related} layout="sidebar" />
        </aside>
      </div>
    </div>
  );
}
