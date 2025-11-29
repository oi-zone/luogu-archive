import type {
  RelatedUser,
  TimelineEntry,
  UserNameColor,
  UsernameHistoryEntry,
  UserProfile,
  UserProfileBundle,
  UserSnapshotAppearance,
  UserTimelinePage,
} from "@luogu-discussion-archive/query";

export const NAME_COLOR_CLASS: Record<UserNameColor, string> = {
  purple: "text-luogu-purple",
  red: "text-luogu-red",
  orange: "text-luogu-orange",
  green: "text-luogu-green",
  blue: "text-luogu-blue",
  gray: "text-luogu-gray",
  cheater: "text-luogu-cheater",
};

export type {
  RelatedUser,
  TimelineEntry,
  UserNameColor,
  UserProfile,
  UserProfileBundle,
  UserSnapshotAppearance,
  UserTimelinePage,
  UsernameHistoryEntry,
};
