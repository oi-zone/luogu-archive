import { cache } from "react";

import {
  getUserProfileBundle,
  type UserProfileBundle,
} from "@luogu-discussion-archive/query";

export const getUserProfileBundleCache = cache(
  async (uid: number): Promise<UserProfileBundle | null> => {
    return getUserProfileBundle(uid);
  },
);
