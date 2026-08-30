/**
 * Luogu code block extensions:
 *
 * - ```cpp line-numbers
 * - ```cpp line-numbers lines=5-6
 * - ```cpp lines=5-6
 *
 * 把这些信息挂到 code 节点的 data / hProperties 上，供后续渲染使用。
 */

import { visit } from "unist-util-visit";

import {
  MARKDOWN_SECURITY_LIMITS,
  parseHighlightRanges,
  utf8ByteLengthExceeds,
} from "./security-limits.js";

/**
 * @typedef {import('mdast').Root} Root
 * @typedef {import('mdast').Code} Code
 * @typedef {import('unified').Processor} Processor
 * @typedef {import('vfile').VFile} VFile
 */

/**
 * @param {string} meta
 * @returns {{
 *   lineNumbers: boolean,
 *   rawLinesSpec: string | null,
 *   ranges: { start: number, end: number }[]
 * }}
 */
function parseMeta(meta, actualLineCount) {
  const result = {
    lineNumbers: false,
    rawLinesSpec: null,
    ranges: [],
  };

  if (
    !meta ||
    typeof meta !== "string" ||
    meta.length > MARKDOWN_SECURITY_LIMITS.maxHighlightSpecLength
  )
    return result;

  result.lineNumbers = /(?:^|\s)line[-_]numbers(?:\s|$)/.test(meta);
  const match = /(?:^|\s)lines=([^\s]+)/.exec(meta);
  if (!match?.[1]) return result;

  const ranges = parseHighlightRanges(match[1], actualLineCount);
  if (ranges.length === 0) return result;
  result.ranges = ranges;
  result.rawLinesSpec = ranges
    .map((range) =>
      range.start === range.end
        ? String(range.start)
        : `${String(range.start)}-${String(range.end)}`,
    )
    .join(",");

  return result;
}

function applyLangDefault(node) {
  if (!node.lang || node.lang === "") {
    node.lang = "cpp";
    // 让 remark-rehype 输出 <code class="language-cpp">
    /** @type {any} */
    const anyNode = node;
    if (!anyNode.data) anyNode.data = {};
    if (!anyNode.data.hProperties) anyNode.data.hProperties = {};
    const props = anyNode.data.hProperties;
    if (!props.className) {
      props.className = ["language-cpp"];
    } else if (Array.isArray(props.className)) {
      if (!props.className.includes("language-cpp")) {
        props.className.push("language-cpp");
      }
    }
  }
}

/**
 * @param {Code} node
 */
function applyCodeMeta(node) {
  /** @type {any} */
  const anyNode = node;
  if (!anyNode.data) anyNode.data = {};
  if (!anyNode.data.hProperties) anyNode.data.hProperties = {};
  const props = anyNode.data.hProperties;

  if (
    utf8ByteLengthExceeds(
      node.value,
      MARKDOWN_SECURITY_LIMITS.maxCodeBlockBytes,
    )
  ) {
    node.value = `${node.value.slice(
      0,
      MARKDOWN_SECURITY_LIMITS.maxCodeBlockPreviewChars,
    )}\n\n[代码块过大，已停止高亮并截断渲染预览]`;
    node.meta = null;
    props["data-ls-code-truncated"] = true;
    return;
  }

  if (!node.meta) return;

  let actualLineCount = 1;
  for (let index = 0; index < node.value.length; index += 1) {
    if (node.value.charCodeAt(index) === 10) actualLineCount += 1;
  }
  if (actualLineCount > MARKDOWN_SECURITY_LIMITS.maxCodeBlockLines) {
    props["data-ls-line-numbers-disabled"] = true;
    return;
  }

  const info = parseMeta(node.meta, actualLineCount);
  const hasHighlight = info.rawLinesSpec != null || info.lineNumbers;
  if (!hasHighlight) return;

  if (info.lineNumbers) {
    // 两套属性，方便前端/高亮器对接
    props["data-ls-line-numbers"] = true;
    props["data-line-numbers"] = true;
  }

  if (info.rawLinesSpec) {
    props["data-ls-highlight-lines"] = info.rawLinesSpec;
    props["data-highlight-lines"] = info.rawLinesSpec;
    anyNode.data.lsHighlightLines = info.ranges;
  }
}

/**
 * 主入口：处理代码块的 Luogu 扩展 meta。
 *
 * @param {Root} tree
 * @param {Processor} _processor
 * @param {VFile} _file
 */
export function transformLuoguCode(tree, _processor, _file) {
  visit(tree, "code", (node) => {
    applyLangDefault(/** @type {Code} */ (node));
    applyCodeMeta(/** @type {Code} */ (node));
  });
}
