"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";

import { ABSOLUTE_DATE_FORMATTER } from "@/lib/time";
import type { UserBasicInfo } from "@/components/user/user-inline-link";
import {
  WaybackModal,
  type WaybackDataSource,
  type WaybackTimelineItem,
} from "@/components/wayback/wayback-modal";

const WAYBACK_HASH = "#wayback";
const PAGE_SIZE = 10;

type SnapshotChangedField = "title" | "content" | "author" | "forum";

type SnapshotTimelineItem = {
  snapshotId: string;
  capturedAt: string;
  lastSeenAt: string;
  title: string;
  hasPrevious: boolean;
  author: UserBasicInfo | null;
  forum: {
    slug: string;
    name: string;
  };
  changedFields: SnapshotChangedField[];
};

type TimelineResponse = {
  items: SnapshotTimelineItem[];
  hasMore: boolean;
  nextCursor: string | null;
};

const FIELD_META: Record<
  SnapshotChangedField,
  { label: string; className: string }
> = {
  title: {
    label: "标题变更",
    className: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  },
  content: {
    label: "正文变更",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  },
  author: {
    label: "作者变更",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  },
  forum: {
    label: "版块漂移",
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  },
};

async function fetchTimeline({
  discussionId,
  cursor,
}: {
  discussionId: number;
  cursor?: string | null;
}): Promise<TimelineResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(PAGE_SIZE));

  if (cursor) {
    params.set("cursor", cursor);
  }

  const response = await fetch(
    `/api/discussions/${discussionId}/snapshots?${params.toString()}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    let message = "加载快照时间线失败";
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload?.error) {
        message = payload.error;
      }
    } catch {
      // ignore JSON parse errors and use default message
    }
    throw new Error(message);
  }

  return response.json() as Promise<TimelineResponse>;
}

function mapTimelineItemToWayback(
  item: SnapshotTimelineItem,
): WaybackTimelineItem {
  const badges = (() => {
    if (!item.hasPrevious) {
      return [
        {
          key: "first",
          label: "首次捕获版本",
          className: "bg-muted text-muted-foreground",
        },
      ];
    }

    if (item.changedFields.length === 0) {
      return [
        {
          key: "unchanged",
          label: "与上一快照一致",
          className: "bg-muted text-muted-foreground",
        },
      ];
    }

    return item.changedFields.map((field) => ({
      key: field,
      label: FIELD_META[field].label,
      className: FIELD_META[field].className,
    }));
  })();

  const lastSeenAt = new Date(item.lastSeenAt);
  const meta = [
    `@${item.snapshotId}`,
    `最后确认于 ${ABSOLUTE_DATE_FORMATTER.format(lastSeenAt)}`,
    `版块 ${item.forum.name}`,
  ];

  if (item.author) {
    meta.push(`作者 ${item.author.name}`);
  }

  return {
    snapshotId: item.snapshotId,
    capturedAt: item.capturedAt,
    lastSeenAt: item.lastSeenAt,
    title: item.title,
    badges,
    meta,
  } satisfies WaybackTimelineItem;
}

export function DiscussionWaybackModal() {
  const params = useParams<{ id: string; snapshot?: string }>();
  const router = useRouter();

  const idParam = params?.id;
  const snapshotParam = params?.snapshot ?? null;
  const discussionId = Number.parseInt(idParam ?? "", 10);
  const isDiscussionIdValid = Number.isFinite(discussionId) && discussionId > 0;

  const dataSource = React.useMemo<WaybackDataSource<WaybackTimelineItem>>(
    () => ({
      key: ["discussion-snapshots", discussionId],
      fetchPage: async ({ cursor }) => {
        const response = await fetchTimeline({ discussionId, cursor });
        return {
          items: response.items.map(mapTimelineItemToWayback),
          hasMore: response.hasMore,
          nextCursor: response.nextCursor,
        };
      },
    }),
    [discussionId],
  );

  const handleSelectSnapshot = React.useCallback(
    (item: WaybackTimelineItem) => {
      if (!isDiscussionIdValid) return;

      const targetPath = `/d/${discussionId}/${item.snapshotId}`;
      const currentPath =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : undefined;

      if (currentPath === targetPath) {
        return;
      }

      router.push(targetPath, { scroll: false });
    },
    [discussionId, isDiscussionIdValid, router],
  );

  return (
    <WaybackModal
      dataSource={dataSource}
      enabled={isDiscussionIdValid}
      hash={WAYBACK_HASH}
      targetSnapshotId={snapshotParam ?? null}
      onSelectSnapshot={handleSelectSnapshot}
      header={{
        title: "时光机",
        description: "作为资深的考古学家，翻阅历史快照，探究帖子的演变。",
      }}
    />
  );
}
