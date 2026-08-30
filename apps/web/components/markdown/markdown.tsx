import * as React from "react";
import { Link as LinkIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

import remarkLuoguFlavor from "@luogu-discussion-archive/remark-lda-lfm";
import {
  MARKDOWN_SECURITY_LIMITS,
  parseHighlightRanges,
  utf8ByteLengthExceeds,
} from "@luogu-discussion-archive/remark-lda-lfm/security-limits";

import { cn } from "@/lib/utils";

import MarkdownCodeBlock from "./markdown-code-block";
import MarkdownLink from "./markdown-link";
import MarkdownSummary from "./markdown-summary";

import "./markdown.css";
import "katex/dist/katex.min.css";
import "./highlight.css";

export type MarkdownDiscussionMentionContext = {
  kind: "discussion";
  discussionId: number;
  relativeReplyId?: number;
  discussionAuthors: number[];
};

export type MarkdownMentionContext = MarkdownDiscussionMentionContext;

type MarkdownProps = {
  children: string;
  originalUrl?: string;
  compact?: boolean;
  enableHeadingAnchors?: boolean;
  mentionContext?: MarkdownMentionContext;
};

type HeadingProps = {
  children?: React.ReactNode;
};

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

function shouldSkipHeadingNode(element: React.ReactElement) {
  if (typeof element.type !== "string") {
    return false;
  }

  if (element.type === "annotation") {
    return true;
  }

  const props = element.props as { className?: string };
  const className = typeof props.className === "string" ? props.className : "";
  if (!className) {
    return false;
  }

  const classList = className.split(/\s+/);
  return classList.includes("katex-mathml");
}

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
        const element = child as React.ReactElement;
        if (shouldSkipHeadingNode(element)) {
          return "";
        }
        const elementChildren = (
          element.props as { children?: React.ReactNode }
        )?.children;
        return flattenHeadingText(elementChildren);
      }
      return "";
    })
    .join(" ")
    .replace(/\s+/g, " ")
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

function isIntrinsicElement(
  node: React.ReactNode,
  tag: keyof React.JSX.IntrinsicElements,
): node is React.ReactElement {
  return React.isValidElement(node) && node.type === tag;
}

function extractCodeText(node: React.ReactNode): string {
  return React.Children.toArray(node)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }
      if (React.isValidElement(child)) {
        return extractCodeText(
          (child.props as { children?: React.ReactNode }).children,
        );
      }
      return "";
    })
    .join("");
}

function countLines(value: string) {
  let count = 1;
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) === 10) count += 1;
  }
  return count;
}

export default function Markdown({
  children,
  originalUrl,
  compact = false,
  enableHeadingAnchors = false,
  mentionContext,
}: MarkdownProps) {
  if (
    utf8ByteLengthExceeds(children, MARKDOWN_SECURITY_LIMITS.maxDocumentBytes)
  ) {
    const preview = children.slice(
      0,
      MARKDOWN_SECURITY_LIMITS.maxPlainTextPreviewChars,
    );
    return (
      <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <p className="font-medium text-amber-700 dark:text-amber-300">
          内容过大，已禁用富文本解析。
        </p>
        <pre className="max-h-80 overflow-auto text-sm break-words whitespace-pre-wrap text-muted-foreground">
          {preview}
          {children.length > preview.length ? "\n…（预览已截断）" : ""}
        </pre>
      </div>
    );
  }

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
              React.createElement(LinkIcon, {
                className: "size-4 markdown-heading-anchor-icon",
                "aria-hidden": "true",
              }),
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
        rehypePlugins={[
          rehypeKatex,
          [rehypeHighlight, { detect: false, ignoreMissing: true }],
        ]}
        skipHtml
        components={{
          p(props) {
            const { node, className, children, ...rest } = props;
            void node;
            let newClassName = className ?? "";
            newClassName = cn(newClassName, "fake-p");
            return (
              <div className={newClassName} {...rest}>
                {children}
              </div>
            );
          },
          pre(props) {
            const { node, children, ...rest } = props;
            void node;
            if (isIntrinsicElement(children, "code")) {
              const codeProps =
                children.props as React.JSX.IntrinsicElements["code"] & {
                  "data-ls-line-numbers"?: boolean;
                  "data-ls-highlight-lines"?: string;
                  "data-ls-code-truncated"?: boolean;
                };
              const languageMatch = /language-([\w-]+)/.exec(
                codeProps.className ?? "",
              );
              const language = languageMatch?.[1] ?? undefined;
              const codeText = extractCodeText(codeProps.children);
              const lineCount = countLines(codeText);
              return (
                <MarkdownCodeBlock
                  className={codeProps.className}
                  language={language}
                  showLineNumbers={codeProps["data-ls-line-numbers"] === true}
                  highlightRanges={parseHighlightRanges(
                    codeProps["data-ls-highlight-lines"],
                    lineCount,
                  )}
                  truncated={codeProps["data-ls-code-truncated"] === true}
                >
                  {codeProps.children}
                </MarkdownCodeBlock>
              );
            }
            return <pre {...rest}>{children}</pre>;
          },
          a(props) {
            const { node, ...rest } = props;
            void node;
            return (
              <MarkdownLink
                originalUrl={originalUrl}
                mentionContext={mentionContext}
                {...rest}
              />
            );
          },
          summary(props) {
            const { node, children, ...rest } = props;
            void node;
            return <MarkdownSummary {...rest}>{children}</MarkdownSummary>;
          },
          ...headingComponents,
          table(props) {
            const { node, children, ...rest } = props;
            void node;
            return (
              <div className="fake-p max-w-full overflow-x-auto">
                <table {...rest}>{children}</table>
              </div>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
