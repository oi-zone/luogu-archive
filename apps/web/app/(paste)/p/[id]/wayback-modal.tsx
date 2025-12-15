"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";

import { ABSOLUTE_DATE_FORMATTER } from "@/lib/time";
import {
  WaybackModal,
  type WaybackDataSource,
  type WaybackTimelineItem,
} from "@/components/wayback/wayback-modal";

const WAYBACK_HASH = "#wayback";
const PAGE_SIZE = 10;

type SnapshotChangedField = "content" | "visibility";

type SnapshotTimelineItem = {
  snapshotId: string;
  capturedAt: string;
  lastSeenAt: string;
  title: string;
  isPublic: boolean;
  changedFields: SnapshotChangedField[];
  hasPrevious: boolean;
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
  content: {
    label: "内容变更",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  },
  visibility: {
    label: "公开状态变化",
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  },
};

async function fetchTimeline({
  pasteId,
  cursor,
}: {
  pasteId: string;
  cursor?: string | null;
}): Promise<TimelineResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(PAGE_SIZE));

  if (cursor) {
    params.set("cursor", cursor);
  }

  const response = await fetch(
    `/api/pastes/${pasteId}/snapshots?${params.toString()}`,
    {
      cache: "no-store",
    },
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
  const meta: React.ReactNode[] = [
    `@${item.snapshotId}`,
    `最后确认于 ${ABSOLUTE_DATE_FORMATTER.format(lastSeenAt)}`,
    item.isPublic ? "公开" : "私密",
  ];

  return {
    snapshotId: item.snapshotId,
    capturedAt: item.capturedAt,
    lastSeenAt: item.lastSeenAt,
    title: item.title,
    badges,
    meta,
  } satisfies WaybackTimelineItem;
}

export function PasteWaybackModal() {
  const params = useParams<{ id: string; snapshot?: string }>();
  const router = useRouter();

  const pasteId = params?.id ?? "";
  const snapshotParam = params?.snapshot ?? null;
  const isPasteIdValid = typeof pasteId === "string" && pasteId.length > 0;

  const dataSource = React.useMemo<WaybackDataSource<WaybackTimelineItem>>(
    () => ({
      key: ["paste-snapshots", pasteId],
      fetchPage: async ({ cursor }) => {
        const response = await fetchTimeline({ pasteId, cursor });
        return {
          items: response.items.map(mapTimelineItemToWayback),
          hasMore: response.hasMore,
          nextCursor: response.nextCursor,
        };
      },
    }),
    [pasteId],
  );

  const handleSelectSnapshot = React.useCallback(
    (item: WaybackTimelineItem) => {
      if (!isPasteIdValid) return;

      const targetPath = `/p/${pasteId}@${item.snapshotId}`;
      const currentPath =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : undefined;

      if (currentPath === targetPath) {
        return;
      }

      router.push(targetPath, { scroll: false });
    },
    [isPasteIdValid, pasteId, router],
  );

  return (
    <WaybackModal
      dataSource={dataSource}
      enabled={isPasteIdValid}
      hash={WAYBACK_HASH}
      targetSnapshotId={snapshotParam ?? null}
      onSelectSnapshot={handleSelectSnapshot}
      header={{
        title: "时光机",
        description: "查看云剪贴板的每一次编辑记录。",
      }}
    />
  );
}
