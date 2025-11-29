import * as React from "react";
import { IconBalloon, IconRosetteDiscountCheck } from "@tabler/icons-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { Badge } from "../ui/badge";

export type UserBasicInfo = {
  id: number;
  name: string;
  badge: string | null;
  color: string;
  ccfLevel: number;
  xcpcLevel: number;
};

export function ccfLevelToColor(level: number): string {
  if (level >= 8) return "orange";
  if (level >= 6) return "blue";
  if (level >= 3) return "green";
  return "cheater";
}

export function xcpcLevelToColor(level: number): string {
  if (level >= 8) return "orange";
  if (level >= 6) return "blue";
  if (level >= 3) return "green";
  return "cheater";
}

export function UserInlineLink({
  className,
  user,
  compact = false,
  avatar = true,
}: {
  className?: string;
  user: UserBasicInfo;
  compact?: boolean;
  avatar?: boolean;
}) {
  return (
    <Link
      href={`/u/${user.id}`}
      className={cn(
        "clear-markdown-style inline-flex items-center rounded-full transition-colors duration-200 hover:bg-muted",
        className,
      )}
      prefetch={false}
    >
      <UserInlineContent user={user} compact={compact} avatar={avatar} />
    </Link>
  );
}

export default UserInlineLink;

export function UserInlineDisplay({
  user,
  compact = false,
  avatar = true,
  className,
}: {
  user: UserBasicInfo;
  compact?: boolean;
  avatar?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "clear-markdown-style inline-flex items-center rounded-full",
        className,
      )}
    >
      <UserInlineContent user={user} compact={compact} avatar={avatar} />
    </span>
  );
}

function UserInlineContent({
  user,
  compact,
  avatar,
}: {
  user: UserBasicInfo;
  compact: boolean;
  avatar: boolean;
}) {
  return (
    <>
      {avatar && (
        <Avatar
          className={cn("bg-muted", compact ? "ms-0.5 size-5" : "size-6")}
        >
          <AvatarImage
            src={`https://cdn.luogu.com.cn/upload/usericon/${user.id}.png`}
            alt={user.name}
          />
          <AvatarFallback className="text-xs font-semibold">
            {user.name.slice(0, 1)}
          </AvatarFallback>
        </Avatar>
      )}

      <span
        className={cn(
          "text-base font-medium",
          compact ? "ms-1" : "ms-1.25",
          user.badge
            ? "me-1.25"
            : user.ccfLevel !== 0
              ? "me-0.75"
              : user.xcpcLevel !== 0
                ? "me-0.5"
                : compact
                  ? "me-1.5"
                  : "me-1.75",
          `text-luogu-${user.color.toLowerCase()}`,
        )}
      >
        {user.name}
      </span>

      {user.badge && (
        <Badge
          className={cn(
            "text-inverse",
            compact && "-ms-0.25",
            user.xcpcLevel !== 0 && user.ccfLevel === 0 ? "me-0.5" : "me-0.75",
            `bg-luogu-${user.color.toLowerCase()}`,
          )}
        >
          {user.badge}
        </Badge>
      )}

      {user.ccfLevel !== 0 && (
        <IconRosetteDiscountCheck
          className={cn(
            "size-5",
            compact && "-ms-0.25",
            user.xcpcLevel !== 0 ? "-me-0.25" : "me-0.5",
            `text-luogu-${ccfLevelToColor(user.ccfLevel)}`,
          )}
          stroke={2}
        />
      )}

      {user.xcpcLevel !== 0 && (
        <IconBalloon
          className={cn(
            "relative top-0.25 me-0.25 size-4.5",
            compact && "-ms-0.25",
            `text-luogu-${xcpcLevelToColor(user.xcpcLevel)}`,
          )}
          stroke={2.2}
        />
      )}
    </>
  );
}
