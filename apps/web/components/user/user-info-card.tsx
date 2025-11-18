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
    <section className="border-border text-card-foreground relative overflow-hidden rounded-3xl border p-6 shadow-sm">
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
                "text-xl font-semibold leading-tight",
                NAME_COLOR_CLASS[profile.nameColor],
              )}
            >
              {profile.name}
            </h2>
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground text-sm">
                #{profile.id}
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
        </div>
      </div>
      <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
        {profile.slogan}
      </p>
      <dl className="bg-muted/40 mt-5 grid grid-cols-2 gap-3 rounded-2xl p-4 text-sm sm:grid-cols-3">
        {[
          { label: "发帖数", value: profile.stats.posts },
          { label: "文章数", value: profile.stats.articles },
          { label: "互动数", value: profile.stats.interactions },
          { label: "陶片数", value: profile.stats.judgements },
          { label: "犇犇数", value: profile.stats.bens },
          { label: "文章获赞数", value: profile.stats.articleUpvotes },
          { label: "文章被收藏数", value: profile.stats.articleFavorites },
        ].map((item) => (
          <div key={item.label}>
            <dt className="text-muted-foreground">{item.label}</dt>
            <dd className="text-foreground text-lg font-semibold">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="text-muted-foreground mt-5 flex flex-wrap items-center gap-2 text-xs font-medium">
        <span className="border-border/60 rounded-full border px-3 py-1">
          {profile.location}
        </span>
        <span className="border-border/60 rounded-full border px-3 py-1">
          首次捕获于 {joinLabel}
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
