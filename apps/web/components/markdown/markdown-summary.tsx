import * as React from "react";
import { CircleAlert, CircleCheck, CircleX, Info } from "lucide-react";

function summaryIcon(type: string) {
  switch (type) {
    case "info":
      return <Info className="relative -top-0.5 me-1 inline-block size-5" />;
    case "success":
      return (
        <CircleCheck className="relative -top-0.5 me-1 inline-block size-5" />
      );
    case "warning":
      return (
        <CircleAlert className="relative -top-0.5 me-1 inline-block size-5" />
      );
    case "error":
      return <CircleX className="relative -top-0.5 me-1 inline-block size-5" />;
    default:
      return <></>;
  }
}

type MarkdownSummaryProps = React.ComponentProps<"summary"> & {
  "data-box-type"?: string;
};

export default function MarkdownSummary(props: MarkdownSummaryProps) {
  if (props["data-box-type"]) {
    return (
      <summary {...props}>
        {summaryIcon(props["data-box-type"]!)}
        {props.children}
      </summary>
    );
  } else {
    return <summary {...props}>{props.children}</summary>;
  }
}
