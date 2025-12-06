import UserInlineLink, {
  UserBasicInfo,
} from "@/components/user/user-inline-link";

export default function UserMagicLinkDirect({
  userInfo,
}: {
  userInfo: Omit<UserBasicInfo, "id"> & { uid: number };
}) {
  return (
    <span className="relative top-1 -mt-1 inline-block">
      <UserInlineLink user={{ ...userInfo, id: userInfo.uid }} compact />
    </span>
  );
}
