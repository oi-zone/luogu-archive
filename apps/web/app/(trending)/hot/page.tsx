import { getHotEntries, resolveEntries } from "@luogu-discussion-archive/query";

import UserInlineLink from "@/components/user/user-inline-link";

export const dynamic = "force-dynamic";

export default async function Page() {
  const entries = await resolveEntries(await getHotEntries());
  return entries.map((entry) => (
    <div key={entry.type + "-" + entry.id}>
      <h2>
        {entry.type.toUpperCase()} #{entry.id}
      </h2>
      {entry.data && (
        <UserInlineLink
          user={{ ...entry.data.author, id: entry.data.author.uid }}
        />
      )}
      <pre>{JSON.stringify(entry, null, 2)}</pre>
    </div>
  ));
}
