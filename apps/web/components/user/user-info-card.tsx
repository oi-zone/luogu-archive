import Image from "next/image";

import { NAME_COLOR_CLASS, type UserProfile } from "@/lib/user-profile-data";
import { cn } from "@/lib/utils";

const DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function UserInfoCard({ profile }: { profile: UserProfile }) {
  const joinLabel = DATE_FORMATTER.format(new Date(profile.joinDate));

  return (
    <section className="border-border text-card-foreground relative overflow-hidden rounded-3xl border p-6 shadow-sm">
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <div className="border-border/80 bg-muted/60 relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl border">
          <Image
            src={profile.avatarUrl}
            alt={profile.name}
            fill
            sizes="80px"
            className="object-cover"
            priority={false}
          />
        </div>
        <div className="min-w-0 space-y-3">
          <div className="space-y-1">
            <h2
              className={cn(
                "text-xl font-semibold leading-tight",
                NAME_COLOR_CLASS[profile.nameColor],
              )}
            >
              {profile.name}
            </h2>
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground text-sm">
                @{profile.username}
              </span>
              {profile.ccfLevel ? (
                <span className="border-border/60 rounded-full border px-2.5 py-0.5 text-[11px] font-medium">
                  CCF Lv.{profile.ccfLevel}
                </span>
              ) : null}
              {profile.highlightTag ? (
                <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-[11px] font-medium">
                  {profile.highlightTag}
                </span>
              ) : null}
            </div>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {profile.headline}
          </p>
        </div>
      </div>
      <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
        {profile.bio}
      </p>
      <dl className="bg-muted/40 mt-5 grid grid-cols-2 gap-3 rounded-2xl p-4 text-sm">
        <div>
          <dt className="text-muted-foreground">文章</dt>
          <dd className="text-foreground text-lg font-semibold">
            {profile.stats.articles}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">讨论</dt>
          <dd className="text-foreground text-lg font-semibold">
            {profile.stats.discussions}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">犇犇</dt>
          <dd className="text-foreground text-lg font-semibold">
            {profile.stats.statuses}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">关注 / 粉丝</dt>
          <dd className="text-foreground text-lg font-semibold">
            {profile.stats.following} / {profile.stats.followers}
          </dd>
        </div>
      </dl>
      <div className="text-muted-foreground mt-5 flex flex-wrap items-center gap-2 text-xs font-medium">
        <span className="border-border/60 rounded-full border px-3 py-1">
          {profile.location}
        </span>
        <span className="border-border/60 rounded-full border px-3 py-1">
          加入于 {joinLabel}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {profile.tags.map((tag) => (
          <span
            key={tag}
            className="bg-primary/10 text-primary inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
          >
            {tag}
          </span>
        ))}
      </div>
    </section>
  );
}
