"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Loader2,
  MessageSquare,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

import { ABSOLUTE_DATE_FORMATTER, formatRelativeTime } from "@/lib/feed-data";
import { createCategoryResults, type SearchResult } from "@/lib/search-data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type TaskStatus = "pending" | "running" | "error" | "completed";
type TaskStepState = "pending" | "running" | "done" | "error";

type QueueTask = {
  id: string;
  type: TaskType;
  title: string;
  status: TaskStatus;
  steps: TaskStep[];
  startedAt: Date;
  updatedAt: Date;
  entityId: string;
  source?: SearchResult;
};

type TaskStep = {
  id: string;
  label: string;
  state: TaskStepState;
  error?: string;
};

const TASK_TYPE_META = {
  article: {
    label: "文章保存任务",
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
    icon: FileText,
    idPrefix: "A",
    stepLabels: ["拉取文章页面", "Markdown 预处理", "存储快照", "刷新索引"],
    titles: () => createCategoryResults("article", 1).map((item) => item.title),
  },
  discussion: {
    label: "讨论保存任务",
    badgeClass: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    icon: MessageSquare,
    idPrefix: "D",
    stepLabels: ["抓取主楼内容", "采集回复", "格式化记录", "写入存档"],
    titles: () =>
      createCategoryResults("discussion", 1).map((item) => item.title),
  },
  user: {
    label: "用户保存任务",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    icon: User,
    idPrefix: "U",
    stepLabels: ["抓取用户主页", "同步动态", "生成报告"],
    titles: () => USER_NAME_SAMPLES.map((name) => `${name} 的资料备份`),
  },
  team: {
    label: "团队保存任务",
    badgeClass: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-300",
    icon: Users,
    idPrefix: "T",
    stepLabels: ["同步团队信息", "抓取题库", "导出成员", "写入档案"],
    titles: () => TEAM_NAME_SAMPLES.map((name) => `${name} 团队快照`),
  },
  paste: {
    label: "剪贴板保存任务",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    icon: ClipboardList,
    idPrefix: "P",
    stepLabels: ["抓取原文", "格式审查", "存档文本"],
    titles: () => PASTE_TITLE_SAMPLES,
  },
} as const;

type TaskType = keyof typeof TASK_TYPE_META;

const USER_NAME_SAMPLES = [
  "李晨曦",
  "陈亦城",
  "汪星河",
  "郑流光",
  "宋知行",
  "许墨言",
];

const TEAM_NAME_SAMPLES = [
  "Graph Hunters",
  "树上飞鸟",
  "算法工坊",
  "竞赛直通车",
  "洛谷夜航队",
  "代码潮汐",
];

const PASTE_TITLE_SAMPLES = [
  "寒假集训作业归档",
  "模板库更新草稿",
  "数据结构讲义",
  "周赛题解草稿",
  "现场记录速记",
  "板子同步",
];

const ERROR_MESSAGES = [
  "网络请求超时，请稍后重试",
  "目标页面访问被拒绝",
  "内容解析失败，结构不完整",
  "写入存储时遇到冲突",
];

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "排队中",
  running: "执行中",
  error: "执行失败",
  completed: "已完成",
};

const STATUS_TONE: Record<TaskStatus, string> = {
  pending: "bg-muted/40 text-muted-foreground",
  running: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  error: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  completed: "bg-primary/10 text-primary",
};

const CARD_BORDER: Record<TaskStatus, string> = {
  pending: "border-border",
  running: "border-emerald-500/60 shadow-emerald-500/10",
  error: "border-rose-500/60 shadow-rose-500/10",
  completed: "border-primary/40",
};

const STEP_STATE_STYLES: Record<
  TaskStepState,
  { indicator: string; container: string; text: string }
> = {
  done: {
    indicator: "bg-emerald-500 text-white",
    container: "border border-emerald-500/30 bg-emerald-500/5",
    text: "text-foreground",
  },
  running: {
    indicator: "border-emerald-500 text-emerald-600",
    container: "border border-emerald-500/40 bg-emerald-500/10 animate-pulse",
    text: "text-foreground",
  },
  pending: {
    indicator: "border border-muted-foreground/30 text-muted-foreground",
    container: "border border-dashed border-border/60",
    text: "text-muted-foreground",
  },
  error: {
    indicator: "bg-rose-500 text-white",
    container: "border border-rose-500/50 bg-rose-500/5",
    text: "text-foreground",
  },
};

export default function QueuePage() {
  const tasks = React.useMemo(() => createQueueTasks(18), []);
  const ITEMS_PER_PAGE = 4;
  const [pageIndex, setPageIndex] = React.useState(0);

  const totalPages = Math.max(1, Math.ceil(tasks.length / ITEMS_PER_PAGE));

  React.useEffect(() => {
    if (pageIndex > totalPages - 1) {
      setPageIndex(totalPages - 1);
    }
  }, [pageIndex, totalPages]);

  const start = pageIndex * ITEMS_PER_PAGE;
  const visibleTasks = tasks.slice(start, start + ITEMS_PER_PAGE);

  const statusStats = React.useMemo(() => {
    return tasks.reduce(
      (acc, task) => {
        acc[task.status] += 1;
        return acc;
      },
      {
        pending: 0,
        running: 0,
        error: 0,
        completed: 0,
      } satisfies Record<TaskStatus, number>,
    );
  }, [tasks]);

  return (
    <div className="flex flex-1 flex-col gap-10 px-6 pb-16 pt-8">
      <header className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">保存队列</h1>
          <p className="text-muted-foreground text-sm">
            查看当前排队的文章、讨论、团队与其他内容的存档进度，了解执行状态与潜在错误。
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(["running", "pending", "error", "completed"] as TaskStatus[]).map(
            (status) => (
              <div
                key={status}
                className={cn(
                  "border-border/60 bg-muted/30 rounded-2xl border p-4",
                  status === "running" &&
                    "border-emerald-500/50 bg-emerald-500/5",
                  status === "error" && "border-rose-500/50 bg-rose-500/5",
                )}
              >
                <div className="text-muted-foreground/70 text-xs font-medium uppercase tracking-wide">
                  {STATUS_LABEL[status]}
                </div>
                <div className="text-foreground mt-2 text-3xl font-semibold">
                  {statusStats[status]}
                </div>
              </div>
            ),
          )}
        </div>
      </header>

      <section className="space-y-6">
        {visibleTasks.length === 0 ? (
          <div className="border-border/60 text-muted-foreground rounded-3xl border border-dashed p-10 text-center text-sm">
            当前没有正在排队的任务。
          </div>
        ) : (
          <div className="space-y-4">
            {visibleTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="border-border/80 bg-background/80 flex items-center justify-between gap-3 rounded-2xl border p-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 rounded-xl"
              onClick={() => setPageIndex((prev) => Math.max(prev - 1, 0))}
              disabled={pageIndex === 0}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              上一页
            </Button>
            <span className="text-muted-foreground text-xs font-medium">
              第 {pageIndex + 1} / {totalPages} 页
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 rounded-xl"
              onClick={() =>
                setPageIndex((prev) => Math.min(prev + 1, totalPages - 1))
              }
              disabled={pageIndex === totalPages - 1}
            >
              下一页
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function TaskCard({ task }: { task: QueueTask }) {
  const meta = TASK_TYPE_META[task.type];
  const Icon = meta.icon as LucideIcon;
  const statusTone = STATUS_TONE[task.status];
  const borderTone = CARD_BORDER[task.status];

  const activeStep = task.steps.find((step) => step.state === "running");
  const failedStep = task.steps.find((step) => step.state === "error");
  const completedCount = task.steps.filter(
    (step) => step.state === "done",
  ).length;

  const statusDescription = (() => {
    switch (task.status) {
      case "running":
        return activeStep
          ? `正在执行：${activeStep.label}`
          : "正在执行任务步骤";
      case "error":
        return failedStep
          ? `执行失败：${failedStep.label}`
          : "执行失败，等待处理";
      case "completed":
        return "已完成全部步骤，等待归档";
      default:
        return "排队等待可用的执行窗口";
    }
  })();

  return (
    <article
      className={cn(
        "bg-background/95 rounded-3xl border p-6 shadow-sm transition-colors",
        borderTone,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="border-border/70 bg-muted/40 flex size-10 items-center justify-center rounded-2xl border">
            <Icon className="text-muted-foreground size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
                  meta.badgeClass,
                )}
              >
                {meta.label}
              </span>
              <span className="text-muted-foreground/70 text-xs">
                #{task.entityId}
              </span>
            </div>
            <h2 className="text-foreground mt-1 text-lg font-semibold">
              {task.title}
            </h2>
          </div>
        </div>

        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
            statusTone,
          )}
        >
          {task.status === "running" && (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          )}
          {task.status === "error" && (
            <AlertTriangle className="size-3.5" aria-hidden="true" />
          )}
          {task.status === "completed" && (
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
          )}
          <span>{STATUS_LABEL[task.status]}</span>
        </span>
      </header>

      <p className="text-muted-foreground mt-3 text-sm">{statusDescription}</p>

      {failedStep?.error ? (
        <div className="mt-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-300">
          {failedStep.error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {task.steps.map((step, index) => (
          <TaskStepItem key={step.id} step={step} index={index} />
        ))}
      </div>

      <dl className="text-muted-foreground mt-6 grid gap-4 text-xs sm:grid-cols-3">
        <InfoRow
          label="开始时间"
          value={ABSOLUTE_DATE_FORMATTER.format(task.startedAt)}
          hint={formatRelativeTime(task.startedAt)}
        />
        <InfoRow
          label="上次更新"
          value={ABSOLUTE_DATE_FORMATTER.format(task.updatedAt)}
          hint={formatRelativeTime(task.updatedAt)}
        />
        <InfoRow
          label="任务进度"
          value={`${completedCount}/${task.steps.length}`}
          hint={activeStep ? `当前：${activeStep.label}` : undefined}
        />
      </dl>
    </article>
  );
}

function TaskStepItem({ step, index }: { step: TaskStep; index: number }) {
  const styles = STEP_STATE_STYLES[step.state];

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl p-3 transition",
        styles.container,
      )}
    >
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-2xl text-sm font-semibold",
          styles.indicator,
        )}
      >
        {index + 1}
      </span>
      <div className="min-w-0">
        <div className={cn("text-sm font-medium", styles.text)}>
          {step.label}
        </div>
        {step.error ? (
          <p className="mt-1 text-xs text-rose-500">{step.error}</p>
        ) : null}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground/70 font-medium uppercase tracking-wide">
        {label}
      </dt>
      <dd className="text-foreground text-sm font-medium">{value}</dd>
      {hint ? (
        <span className="text-muted-foreground/70 text-[11px]">{hint}</span>
      ) : null}
    </div>
  );
}

function createQueueTasks(count: number): QueueTask[] {
  return Array.from({ length: count }, (_, index) => {
    const taskType = pickRandom(Object.keys(TASK_TYPE_META) as TaskType[]);
    const meta = TASK_TYPE_META[taskType];
    const status = pickRandom<TaskStatus>([
      "running",
      "pending",
      "pending",
      "completed",
      Math.random() > 0.7 ? "error" : "pending",
    ]);

    const startedAt = new Date(Date.now() - getRandomInt(20, 180) * 60 * 1000);
    const updatedAt = new Date(
      startedAt.getTime() + getRandomInt(5, 240) * 60 * 1000,
    );

    const stepLabels = meta.stepLabels;
    const steps: TaskStep[] = stepLabels.map((label, stepIndex) => ({
      id: `${taskType}-step-${index}-${stepIndex}`,
      label,
      state: "pending",
    }));

    if (status === "completed") {
      steps.forEach((step) => {
        step.state = "done";
      });
    } else if (status === "running") {
      const activeIndex = getRandomInt(0, steps.length - 1);
      steps.forEach((step, stepIndex) => {
        if (stepIndex < activeIndex) {
          step.state = "done";
        } else if (stepIndex === activeIndex) {
          step.state = "running";
        }
      });
    } else if (status === "error") {
      const failedIndex = getRandomInt(0, steps.length - 1);
      steps.forEach((step, stepIndex) => {
        if (stepIndex < failedIndex) {
          step.state = "done";
        } else if (stepIndex === failedIndex) {
          step.state = "error";
          step.error = pickRandom(ERROR_MESSAGES);
        }
      });
    }

    const title = pickRandom(meta.titles());
    const entityId = `${meta.idPrefix}${String(getRandomInt(1024, 9999))}`;

    return {
      id: `${taskType}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      type: taskType,
      title,
      status,
      steps,
      startedAt,
      updatedAt,
      entityId,
    };
  });
}

function pickRandom<T>(collection: readonly T[]): T {
  const index = Math.floor(Math.random() * collection.length);
  return collection[index]!;
}

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
