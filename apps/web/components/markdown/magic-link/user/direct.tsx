import UserInlineLink, {
  UserBasicInfo,
} from "@/components/user/user-inline-link";

export default function UserMagicLinkDirect({
  userInfo,
}: {
  userInfo: UserBasicInfo;
}) {
  return (
    <span className="relative top-1 -mt-1 inline-block">
      <UserInlineLink user={userInfo} compact />
    </span>
  );
}
