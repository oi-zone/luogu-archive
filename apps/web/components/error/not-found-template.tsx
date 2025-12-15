import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  QueueJobButton,
  type QueueJobButtonProps,
} from "@/components/operation-panel/queue-job-button";

type NotFoundTemplateProps = {
  Icon: LucideIcon;
  title: string;
  hint: string;
  queueJobButtonProps?: QueueJobButtonProps;
  className?: string;
};

export function NotFoundTemplate({
  Icon,
  title,
  hint,
  queueJobButtonProps,
  className,
}: NotFoundTemplateProps) {
  return (
    <div
      className={cn(
        "mt-[calc((100dvh-4rem)/2-6rem)] flex items-center justify-center px-6",
        className,
      )}
    >
      <div className="flex w-max max-w-2xl gap-8">
        <div className="flex size-20 items-center justify-center">
          <Icon className="size-20 stroke-[1.25]" aria-hidden="true" />
        </div>
        <div className="flex flex-1 flex-col gap-4 text-left">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
            <p className="leading-relaxed text-muted-foreground">{hint}</p>
          </div>
          {queueJobButtonProps ? (
            <div>
              <QueueJobButton {...queueJobButtonProps} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
