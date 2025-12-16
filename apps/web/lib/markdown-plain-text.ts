import { renderToString as renderKatex } from "katex";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { unified } from "unified";

import remarkLuoguFlavor from "@luogu-discussion-archive/remark-lda-lfm";

const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "list",
  "listItem",
  "table",
  "tableRow",
  "tableCell",
  "thematicBreak",
  "definition",
]);

/**
 * Render markdown (with LDA extensions) into plain text. All formatting,
 * links, images, and media are stripped; only readable text remains.
 */
export function renderMarkdownToPlainText(markdown: string): string {
  const processor = unified()
    .use(remarkParse)
    .use(remarkMath)
    .use(remarkLuoguFlavor);
  const tree = processor.parse(markdown ?? "");
  const transformed = processor.runSync(tree);

  const raw = flattenText(transformed);
  const normalized = raw.replace(/\s+/g, " ");
  // Remove stray spaces that appear before punctuation (e.g., inline directive fallbacks).
  return normalized.replace(/\s+([:;,!?])/g, "$1").trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flattenText(node: any, parts: string[] = []): string {
  switch (node?.type) {
    case "text":
    case "inlineCode":
    case "code": {
      if (typeof node.value === "string") {
        parts.push(node.value);
      }
      break;
    }
    case "inlineMath":
    case "math": {
      if (typeof node.value === "string") {
        parts.push(renderLatexToText(node.value));
      }
      break;
    }
    case "break": {
      parts.push(" ");
      break;
    }
    default: {
      if (Array.isArray(node?.children)) {
        for (const child of node.children) {
          flattenText(child, parts);
        }
        if (BLOCK_TYPES.has(node.type)) {
          parts.push(" ");
        }
      }
    }
  }

  return parts.join(" ");
}

function renderLatexToText(latex: string): string {
  try {
    const mathml = renderKatex(latex, {
      output: "mathml",
      throwOnError: false,
      strict: "ignore",
    });
    const withoutAnnotation = mathml.replace(
      /<annotation[^>]*>[\s\S]*?<\/annotation>/gi,
      " ",
    );
    const stripped = withoutAnnotation.replace(/<[^>]+>/g, " ");
    return decodeEntities(stripped).replace(/\s+/g, " ").trim();
  } catch {
    return latex;
  }
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}
