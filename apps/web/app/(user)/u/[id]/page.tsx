import { getUserProfileBundleCache } from "@/app/(user)/u/[id]/data-cache";
import { notFound } from "next/navigation";

import { NAME_COLOR_CLASS } from "@/lib/user-profile-shared";
import { cn } from "@/lib/utils";
import { BreadcrumbSetter } from "@/components/layout/breadcrumb-context";
import { UserInfoCard } from "@/components/user/user-info-card";
import { UserRecommendations } from "@/components/user/user-recommendations";
import { UserTimeline } from "@/components/user/user-timeline";
import { UsernameHistoryCard } from "@/components/user/username-history-card";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const uid = Number.parseInt(id, 10);
  const data = await getUserProfileBundleCache(uid);
  if (!data) notFound();
  const { profile, usernameHistory, related, timeline } = data;
  const breadcrumbs = [
    { label: "首页", href: "/" },
    { label: "用户", href: "/users" },
    { label: profile.name },
  ];

  return (
    <div className="mx-auto w-full px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <BreadcrumbSetter trail={breadcrumbs} />
      <header className="mb-8 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1
            className={cn(
              "text-3xl font-semibold",
              NAME_COLOR_CLASS[profile.nameColor],
            )}
          >
            {profile.name}
          </h1>
          <span className="text-muted-foreground text-sm">#{profile.id}</span>
          {profile.ccfLevel ? (
            <span className="border-border/60 rounded-full border px-3 py-1 text-xs font-medium">
              CCF Lv.{profile.ccfLevel}
            </span>
          ) : null}
          {profile.highlightTag ? (
            <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-medium">
              {profile.highlightTag}
            </span>
          ) : null}
        </div>
        <p className="text-muted-foreground max-w-3xl text-base">
          {profile.slogan}
        </p>
      </header>
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
          <UserTimeline entries={timeline} />
        </div>
        <aside className="hidden 2xl:col-start-3 2xl:row-start-1 2xl:block">
          <UserRecommendations users={related} layout="sidebar" />
        </aside>
      </div>
    </div>
  );
}
