import Markdown from "@/components/markdown/markdown";

import { getPasteData } from "../../data-cache";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; snapshot: string }>;
}) {
  const { id, snapshot: snapshotStr } = await params;
  const snapshot = new Date(parseInt(snapshotStr, 36));

  const paste = await getPasteData(id, snapshot);

  return paste.content !== null ? (
    <Markdown originalUrl={`https://www.luogu.com.cn/paste/${paste.id}`}>
      {paste.content}
    </Markdown>
  ) : (
    <div>啊嘞？！云剪贴板不见了！</div>
  );
}
