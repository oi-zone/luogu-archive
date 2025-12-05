import { getActiveUsers, resolveUsers } from "@luogu-discussion-archive/query";

import { cn } from "@/lib/utils";
import UserInlineLink from "@/components/user/user-inline-link";

export const dynamic = "force-dynamic";

const rankColors = ["text-yellow-400", "text-gray-400", "text-amber-700"];

export default async function ActiveUsers() {
  const activeUsers = await getActiveUsers(120);
  const users = await resolveUsers(activeUsers.map((u) => u.uid));
  const activeUsersWithData = activeUsers
    .filter((_u, i) => users[i].data !== null)
    .map((u, i) => ({
      ...u,
      ...users[i].data!,
    }));

  return (
    <div>
      <h3 className="text-xl font-bold">龙王榜</h3>
      <ol className="mt-4 list-none space-y-4">
        {activeUsersWithData.map((user, index) => (
          <li className="block" key={user.uid}>
            <div className="inline-flex w-full items-center justify-center gap-3">
              <span
                className={cn(
                  "w-6 select-none",
                  index < rankColors.length
                    ? "font-bold " + rankColors[index]
                    : "text-muted-foreground",
                )}
              >
                {index + 1}
              </span>
              <span className="flex-1">
                <UserInlineLink
                  user={{ ...user, id: user.uid }}
                  className="align-middle"
                />
              </span>
              <span className="text-sm text-muted-foreground">
                {user.score.toFixed(2)}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
