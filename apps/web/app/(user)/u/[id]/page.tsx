import {
  generateUserProfileBundle,
  NAME_COLOR_CLASS,
} from "@/lib/user-profile-data";
import { cn } from "@/lib/utils";
import { UserInfoCard } from "@/components/user/user-info-card";
import { UserRecommendations } from "@/components/user/user-recommendations";
import { UserTimeline } from "@/components/user/user-timeline";
import { UsernameHistoryCard } from "@/components/user/username-history-card";

export default function UserDetailPage({ params }: { params: { id: string } }) {
  const data = generateUserProfileBundle(params.id);
  const { profile, usernameHistory, related, timeline } = data;

  return (
    <div className="mx-auto w-full px-4 pb-16 pt-8 sm:px-6 lg:px-8">
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
          <span className="text-muted-foreground text-sm">
            @{profile.username}
          </span>
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
          {profile.headline}
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
