import * as React from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

import remarkLuoguFlavor from "@luogu-discussion-archive/remark-lda-lfm";

import { cn } from "@/lib/utils";

import MarkdownLink from "./markdown-link";

import "katex/dist/katex.min.css";

import MarkdownSummary from "./markdown-summary";

type MarkdownProps = {
  children: string;
  originalUrl?: string;
  compact?: boolean;
  enableHeadingAnchors?: boolean;
};

type HeadingProps = {
  children?: React.ReactNode;
};

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

function flattenHeadingText(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((child) => {
      if (typeof child === "string") {
        return child;
      }
      if (typeof child === "number") {
        return String(child);
      }
      if (React.isValidElement(child)) {
        const elementChildren = (child.props as { children?: React.ReactNode })
          ?.children;
        return flattenHeadingText(elementChildren);
      }
      return "";
    })
    .join(" ")
    .trim();
}

const SECTION_PREFIX = "section";

function slugify(text: string): string {
  if (!text) {
    return SECTION_PREFIX;
  }
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "") || SECTION_PREFIX
  );
}

export default function Markdown({
  children,
  originalUrl,
  compact = false,
  enableHeadingAnchors = false,
}: MarkdownProps) {
  const headingSlugCounter: Record<string, number> = {};

  const createHeadingComponent = (level: (typeof HEADING_LEVELS)[number]) => {
    const HeadingComponent = ({ children }: HeadingProps) => {
      const text = flattenHeadingText(children);
      const baseSlug = slugify(text);
      const count = headingSlugCounter[baseSlug] ?? 0;
      headingSlugCounter[baseSlug] = count + 1;
      const uniqueSlug = count === 0 ? baseSlug : `${baseSlug}-${count}`;
      const headingId = `${SECTION_PREFIX}-${uniqueSlug}`;

      const headingProps = enableHeadingAnchors
        ? {
            id: headingId,
            "data-heading-id": headingId,
            "data-heading-text": text,
            "data-heading-level": String(level),
            "data-md-heading": "true",
          }
        : {};

      const HeadingTag = `h${level}` as keyof React.JSX.IntrinsicElements;

      return React.createElement(
        HeadingTag,
        {
          ...headingProps,
          className: cn(
            enableHeadingAnchors && "markdown-heading-anchor-wrapper",
          ),
        },
        React.createElement(
          "span",
          { className: "markdown-heading-text" },
          children,
        ),
        enableHeadingAnchors
          ? React.createElement(
              "a",
              {
                href: `#${headingId}`,
                className: "markdown-heading-anchor",
                "aria-label": `跳转到 ${text}`,
              },
              "#",
            )
          : null,
      );
    };

    return HeadingComponent;
  };

  const headingComponents = enableHeadingAnchors
    ? HEADING_LEVELS.reduce<Record<string, React.ComponentType<HeadingProps>>>(
        (acc, level) => {
          acc[`h${level}`] = createHeadingComponent(level);
          return acc;
        },
        {},
      )
    : {};

  return (
    <div className={cn("markdown-body", { "markdown-body-compact": compact })}>
      <ReactMarkdown
        remarkPlugins={[
          [remarkMath, {}],
          [remarkLuoguFlavor, { linkOriginalUrl: originalUrl }],
        ]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        skipHtml
        components={{
          a(props) {
            const { node, ...rest } = props;
            void node;
            return <MarkdownLink originalUrl={originalUrl} {...rest} />;
          },
          summary(props) {
            const { node, children, ...rest } = props;
            void node;
            return <MarkdownSummary {...rest}>{children}</MarkdownSummary>;
          },
          ...headingComponents,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
