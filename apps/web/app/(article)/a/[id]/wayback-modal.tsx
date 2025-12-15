"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";

import { getCategoryInfo } from "@/lib/category-info";
import { ABSOLUTE_DATE_FORMATTER } from "@/lib/time";
import {
  WaybackModal,
  type WaybackDataSource,
  type WaybackTimelineItem,
} from "@/components/wayback/wayback-modal";

const WAYBACK_HASH = "#wayback";
const PAGE_SIZE = 10;

type SnapshotChangedField =
  | "title"
  | "content"
  | "category"
  | "status"
  | "solution"
  | "collection"
  | "promoteStatus"
  | "adminNote";

type SnapshotTimelineItem = {
  snapshotId: string;
  capturedAt: string;
  lastSeenAt: string;
  title: string;
  category: number;
  status: number;
  solutionFor: {
    pid: string;
    title: string;
  } | null;
  collection: {
    id: number;
    name: string;
  } | null;
  promoteStatus: number;
  adminNote: string | null;
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
  title: {
    label: "标题变更",
    className: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  },
  content: {
    label: "正文变更",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  },
  category: {
    label: "分类调整",
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  },
  status: {
    label: "状态更新",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  },
  solution: {
    label: "题解关联变更",
    className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300",
  },
  collection: {
    label: "合集变动",
    className: "bg-pink-500/10 text-pink-600 dark:text-pink-300",
  },
  promoteStatus: {
    label: "推荐位更新",
    className: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  },
  adminNote: {
    label: "管理提醒变更",
    className: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  },
};

async function fetchTimeline({
  articleId,
  cursor,
}: {
  articleId: string;
  cursor?: string | null;
}): Promise<TimelineResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(PAGE_SIZE));

  if (cursor) {
    params.set("cursor", cursor);
  }

  const response = await fetch(
    `/api/articles/${articleId}/snapshots?${params.toString()}`,
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
  const categoryName = getCategoryInfo(item.category).name;

  const meta: React.ReactNode[] = [
    `@${item.snapshotId}`,
    `最后确认于 ${ABSOLUTE_DATE_FORMATTER.format(lastSeenAt)}`,
    `分类 ${categoryName}`,
  ];

  if (item.collection) {
    meta.push(`合集 ${item.collection.name}`);
  }

  if (item.solutionFor) {
    meta.push(`关联题目 ${item.solutionFor.pid}`);
  }

  if (item.adminNote) {
    meta.push("包含管理提醒");
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

export function ArticleWaybackModal() {
  const params = useParams<{ id: string; snapshot?: string }>();
  const router = useRouter();

  const articleId = params?.id ?? "";
  const snapshotParam = params?.snapshot ?? null;
  const isArticleIdValid =
    typeof articleId === "string" && articleId.length > 0;

  const dataSource = React.useMemo<WaybackDataSource<WaybackTimelineItem>>(
    () => ({
      key: ["article-snapshots", articleId],
      fetchPage: async ({ cursor }) => {
        const response = await fetchTimeline({ articleId, cursor });
        return {
          items: response.items.map(mapTimelineItemToWayback),
          hasMore: response.hasMore,
          nextCursor: response.nextCursor,
        };
      },
    }),
    [articleId],
  );

  const handleSelectSnapshot = React.useCallback(
    (item: WaybackTimelineItem) => {
      if (!isArticleIdValid) return;

      const targetPath = `/a/${articleId}@${item.snapshotId}`;
      const currentPath =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : undefined;

      if (currentPath === targetPath) {
        return;
      }

      router.push(targetPath, { scroll: false });
    },
    [articleId, isArticleIdValid, router],
  );

  return (
    <WaybackModal
      dataSource={dataSource}
      enabled={isArticleIdValid}
      hash={WAYBACK_HASH}
      targetSnapshotId={snapshotParam ?? null}
      onSelectSnapshot={handleSelectSnapshot}
      header={{
        title: "时光机",
        description: "浏览文章的存档轨迹，回到任意一次快照。",
      }}
    />
  );
}
