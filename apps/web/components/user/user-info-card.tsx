import { NAME_COLOR_CLASS, type UserProfile } from "@/lib/user-profile-shared";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function UserInfoCard({ profile }: { profile: UserProfile }) {
  const joinLabel = DATE_FORMATTER.format(new Date(profile.joinDate));

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border p-6 text-card-foreground shadow-sm">
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border">
          <Avatar className="size-full">
            <AvatarImage src={profile.avatarUrl} alt={profile.name} />
            <AvatarFallback className="text-xs font-semibold">
              {profile.name.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="min-w-0 space-y-3">
          <div className="space-y-1">
            <h2
              className={cn(
                "text-xl leading-tight font-semibold",
                NAME_COLOR_CLASS[profile.nameColor],
              )}
            >
              {profile.name}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="text-sm text-muted-foreground">
                #{profile.id}
              </span>
              {profile.ccfLevel ? (
                <span className="rounded-full border border-border/60 px-2.5 py-0.5 text-[11px] font-medium">
                  CCF Lv.{profile.ccfLevel}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        {profile.slogan}
      </p>
      <dl className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-muted/40 p-4 text-sm sm:grid-cols-3">
        {[
          { label: "发帖", value: profile.stats.posts },
          { label: "文章", value: profile.stats.articles },
          { label: "互动", value: profile.stats.interactions },
          { label: "陶片", value: profile.stats.judgements },
          // { label: "犇犇数", value: profile.stats.bens },
          { label: "获赞", value: profile.stats.articleUpvotes },
          { label: "收藏", value: profile.stats.articleFavorites },
        ].map((item) => (
          <div key={item.label}>
            <dt className="text-muted-foreground">{item.label}</dt>
            <dd className="text-lg font-semibold text-foreground">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="rounded-full border border-border/60 px-3 py-1">
          {profile.location}
        </span>
        <span className="rounded-full border border-border/60 px-3 py-1">
          首次捕获于 {joinLabel}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {profile.tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
          >
            {tag}
          </span>
        ))}
      </div>
    </section>
  );
}
