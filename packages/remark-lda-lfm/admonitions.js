/**
 * Utilities for transforming custom :::info style admonitions into <details> nodes.
 */

const BOX_TYPES = new Set(["info", "success", "warning", "error"]);
const DEFAULT_TITLES = {
  info: "Info",
  success: "Success",
  warning: "Warning",
  error: "Error",
};

function nodeToString(node) {
  if (!node) return "";
  if (typeof node.value === "string") return node.value;
  if ("children" in node && Array.isArray(node.children)) {
    return node.children.map((child) => nodeToString(child)).join("");
  }
  return "";
}

function getParagraphValue(node, file, options = {}) {
  if (!node || node.type !== "paragraph") return null;

  const textFromChildren = (node.children || [])
    .map((child) => nodeToString(child))
    .join("");

  if (options.preferChildren) {
    return textFromChildren;
  }

  const fileValue = file && typeof file.value === "string" ? file.value : null;
  const startOffset = node.position?.start?.offset;
  const endOffset = node.position?.end?.offset;
  if (
    fileValue &&
    typeof startOffset === "number" &&
    typeof endOffset === "number"
  ) {
    const slice = fileValue.slice(startOffset, endOffset);
    if (slice.length > 0) {
      return slice;
    }
  }

  return textFromChildren;
}

function parseTrailer(raw, boxType) {
  let rest = raw.trim();
  let title = DEFAULT_TITLES[boxType];
  let isOpen = false;

  if (rest.startsWith("[")) {
    const closingIndex = rest.indexOf("]");
    if (closingIndex !== -1) {
      title = rest.slice(1, closingIndex);
      rest = rest.slice(closingIndex + 1).trim();
    }
  }

  if (rest.startsWith("{")) {
    const closingIndex = rest.indexOf("}");
    if (closingIndex !== -1) {
      const attributes = rest.slice(1, closingIndex).trim();
      if (
        attributes.split(/\s+/).some((token) => token.toLowerCase() === "open")
      ) {
        isOpen = true;
      }
    }
  }

  return { title, isOpen };
}

function parseSummaryChildren(processor, value) {
  if (!value) return [];
  const parsed = processor.parse(value);
  const first = parsed.children[0];
  if (first && first.type === "paragraph") {
    return first.children;
  }
  return [];
}

function extractStandaloneAdmonition(node, processor, file) {
  const text = getParagraphValue(node, file);
  if (text == null) return null;

  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return null;

  const openingMatch = /^(:{3,})(info|success|warning|error)(.*)$/.exec(
    lines[0].trim(),
  );
  if (!openingMatch) return null;

  const marker = openingMatch[1];
  const boxType = openingMatch[2].toLowerCase();
  if (!BOX_TYPES.has(boxType)) return null;

  const trailer = openingMatch[3] ?? "";
  let closingLine = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === marker) {
      closingLine = i;
      break;
    }
  }

  if (closingLine === -1) return null;

  const contentRaw = lines.slice(1, closingLine).join("\n");
  const contentTree = processor.parse(contentRaw);
  transformInParent(contentTree, processor, { value: contentRaw });
  const contentNodes = contentTree.children;

  const { title, isOpen } = parseTrailer(trailer, boxType);
  const summaryChildren = parseSummaryChildren(processor, title);
  const summaryNode = {
    type: "paragraph",
    data: { hName: "summary", hProperties: { "data-box-type": boxType } },
    children:
      summaryChildren.length > 0
        ? summaryChildren
        : [{ type: "text", value: title }],
  };

  const detailsNode = {
    type: "lfmAdmonition",
    data: {
      hName: "details",
      hProperties: {
        className: [boxType],
        ...(isOpen ? { open: "" } : {}),
      },
    },
    children: [summaryNode, ...contentNodes],
  };

  const trailingLines = lines
    .slice(closingLine + 1)
    .join("\n")
    .trim();
  let trailingNodes = [];
  if (trailingLines.length > 0) {
    const trailingTree = processor.parse(trailingLines);
    transformInParent(trailingTree, processor, { value: trailingLines });
    trailingNodes = trailingTree.children;
  }

  return { details: detailsNode, trailing: trailingNodes };
}

function transformInParent(parent, processor, file) {
  if (!parent.children) return;
  const children = parent.children;

  for (let index = children.length - 1; index >= 0; index -= 1) {
    const node = children[index];

    if (node.type === "lfmAdmonition") {
      transformInParent(node, processor, file);
      continue;
    }

    if (node.type !== "paragraph") {
      if (node && typeof node === "object" && "children" in node) {
        transformInParent(node, processor, file);
      }
      continue;
    }

    if (node.data && node.data.hName === "summary") {
      continue;
    }

    const expanded = expandParagraphWithAdmonitions(node, processor, file);
    if (expanded) {
      children.splice(index, 1, ...expanded);
      continue;
    }

    const standalone = extractStandaloneAdmonition(node, processor, file);
    if (standalone) {
      children.splice(index, 1, standalone.details, ...standalone.trailing);
      transformInParent(standalone.details, processor, file);
      continue;
    }

    const text = getParagraphValue(node, file);
    if (!text) continue;

    const openingMatch = /^(:{3,})(info|success|warning|error)([^]*)$/i.exec(
      text.trim(),
    );
    if (!openingMatch) continue;

    const marker = openingMatch[1];
    const boxType = openingMatch[2].toLowerCase();
    if (!BOX_TYPES.has(boxType)) continue;

    const trailer = openingMatch[3] ?? "";
    const closingPattern = new RegExp(`^${marker}$`);

    let offset = index + 1;
    let closingIndex = -1;
    while (offset < children.length) {
      const candidate = children[offset];
      if (candidate && candidate.type === "paragraph") {
        const candidateFullText = getParagraphValue(candidate, file, {
          preferChildren: true,
        });
        if (candidateFullText && candidateFullText.includes("\n")) {
          const parts = candidateFullText
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
          if (parts.length > 1 && parts.every((line) => /^:{3,}$/.test(line))) {
            const replacement = parts.map((line) => ({
              type: "paragraph",
              children: [{ type: "text", value: line }],
            }));
            children.splice(offset, 1, ...replacement);
            continue;
          }
        }
      }

      const candidateText =
        candidate && candidate.type === "paragraph"
          ? getParagraphValue(candidate, file, { preferChildren: true })
          : null;
      if (candidateText && closingPattern.test(candidateText.trim())) {
        closingIndex = offset;
        break;
      }
      offset += 1;
    }

    if (closingIndex === -1) continue;

    const contentNodes = children.slice(index + 1, closingIndex);
    const { title, isOpen } = parseTrailer(trailer, boxType);
    const summaryChildren = parseSummaryChildren(processor, title);
    const summaryNode = {
      type: "paragraph",
      data: { hName: "summary", hProperties: { "data-box-type": boxType } },
      children:
        summaryChildren.length > 0
          ? summaryChildren
          : [{ type: "text", value: title }],
    };

    const detailsNode = {
      type: "lfmAdmonition",
      data: {
        hName: "details",
        hProperties: {
          className: [boxType],
          ...(isOpen ? { open: "" } : {}),
        },
      },
      children: [summaryNode, ...contentNodes],
    };

    children.splice(index, closingIndex - index + 1, detailsNode);
    transformInParent(detailsNode, processor, file);
  }
}

export function transformAdmonitions(tree, processor, file) {
  transformInParent(tree, processor, file);
}

function expandParagraphWithAdmonitions(node, processor, file) {
  const text = getParagraphValue(node, file);
  if (!text || !text.includes(":")) return null;

  const lines = text.split(/\r?\n/);
  let index = 0;
  let converted = false;
  const output = [];
  let buffer = [];

  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();
    const match = /^(:{3,})(info|success|warning|error)(.*)$/.exec(trimmed);

    if (match) {
      const marker = match[1];
      const boxType = match[2].toLowerCase();
      if (!BOX_TYPES.has(boxType)) {
        buffer.push(rawLine);
        index += 1;
        continue;
      }

      const closingIndex = findClosingLine(lines, index + 1, marker);
      if (closingIndex === -1) {
        buffer.push(rawLine);
        index += 1;
        continue;
      }

      converted = true;

      if (buffer.length > 0) {
        output.push(...parseTextFragment(processor, buffer.join("\n")));
        buffer = [];
      }

      const trailer = match[3] ?? "";
      const contentLines = lines.slice(index + 1, closingIndex);
      const contentText = contentLines.join("\n");
      const contentNodes = parseTextFragment(processor, contentText);

      const { title, isOpen } = parseTrailer(trailer, boxType);
      const summaryChildren = parseSummaryChildren(processor, title);
      const summaryNode = {
        type: "paragraph",
        data: { hName: "summary", hProperties: { "data-box-type": boxType } },
        children:
          summaryChildren.length > 0
            ? summaryChildren
            : [{ type: "text", value: title }],
      };

      const detailsNode = {
        type: "lfmAdmonition",
        data: {
          hName: "details",
          hProperties: {
            className: [boxType],
            ...(isOpen ? { open: "" } : {}),
          },
        },
        children: [summaryNode, ...contentNodes],
      };

      output.push(detailsNode);
      index = closingIndex + 1;
      continue;
    }

    buffer.push(rawLine);
    index += 1;
  }

  if (!converted) {
    return null;
  }

  if (buffer.length > 0) {
    output.push(...parseTextFragment(processor, buffer.join("\n")));
  }

  return output;
}

function findClosingLine(lines, startIndex, marker) {
  for (let i = startIndex; i < lines.length; i += 1) {
    const candidate = lines[i];
    if (!candidate) continue;
    if (candidate.trim() === marker) {
      return i;
    }
  }
  return -1;
}

function parseTextFragment(processor, value) {
  const normalized = value.replace(/^[\r\n]+|[\r\n]+$/g, "");
  if (!normalized) {
    return [];
  }

  const parsed = processor.parse(normalized);
  transformInParent(parsed, processor, { value: normalized });
  return parsed.children;
}
