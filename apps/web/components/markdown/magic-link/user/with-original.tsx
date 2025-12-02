import UserInlineLink, {
  UserBasicInfo,
  UserInlineDisplay,
} from "@/components/user/user-inline-link";

import LinkWithOriginalRaw from "../link-with-original-raw";

export default function UserMagicLinkWithOriginal({
  userInfo,
  children,
}: {
  userInfo: UserBasicInfo;
  children: React.ReactNode;
}) {
  return (
    <LinkWithOriginalRaw
      originalRaw={
        <UserInlineLink
          user={{
            ...userInfo,
            name: children as string,
          }}
          compact
          nameColorOverride="text-magic"
          className="rounded-full transition-colors duration-200 hover:bg-primary/7"
        />
      }
      preview={<UserInlineDisplay user={userInfo} compact />}
      className="relative top-1.5 mx-0 -mt-1 inline-block overflow-hidden rounded-full leading-0"
      outerClassName="rounded-full"
    />
  );
}
