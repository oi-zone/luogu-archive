import { UserRound } from "lucide-react";

import {
  UserBasicInfo,
  UserInlineDisplay,
} from "@/components/user/user-inline-link";

import LinkWithOriginal from "../link-with-original";

export default function UserMagicLinkWithOriginal({
  userInfo,
  children,
}: {
  userInfo: UserBasicInfo;
  children: React.ReactNode;
}) {
  return (
    <LinkWithOriginal
      href={`/u/${userInfo.id}`}
      Icon={UserRound}
      original={<span className="font-medium">{children}</span>}
      preview={<UserInlineDisplay user={userInfo} compact />}
    />
  );
}
