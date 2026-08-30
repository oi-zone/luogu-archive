export const MARKDOWN_SECURITY_LIMITS = Object.freeze({
  maxDocumentBytes: 512 * 1024,
  maxCodeBlockBytes: 128 * 1024,
  maxCodeBlockPreviewChars: 8 * 1024,
  maxCodeBlockLines: 5_000,
  maxTableRows: 200,
  maxTableColumns: 50,
  maxDirectiveDepth: 16,
  maxMagicLinks: 100,
  maxLinkUrlLength: 2_048,
  maxLinkLabelLength: 512,
  maxLinkSourceLength: 4_096,
  maxHighlightRanges: 64,
  maxHighlightRangeLength: 1_000,
  maxHighlightedLines: 1_000,
  maxHighlightDigitLength: 6,
  maxHighlightSpecLength: 4_096,
  maxPlainTextPreviewChars: 8 * 1024,
});

export function utf8ByteLength(value) {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      index + 1 < value.length &&
      value.charCodeAt(index + 1) >= 0xdc00 &&
      value.charCodeAt(index + 1) <= 0xdfff
    ) {
      bytes += 4;
      index += 1;
    } else bytes += 3;
  }
  return bytes;
}

export function utf8ByteLengthExceeds(value, maximum) {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      index + 1 < value.length &&
      value.charCodeAt(index + 1) >= 0xdc00 &&
      value.charCodeAt(index + 1) <= 0xdfff
    ) {
      bytes += 4;
      index += 1;
    } else bytes += 3;
    if (bytes > maximum) return true;
  }
  return false;
}

export function parseHighlightRanges(spec, actualLineCount) {
  const limits = MARKDOWN_SECURITY_LIMITS;
  if (
    !spec ||
    typeof spec !== "string" ||
    spec.length > limits.maxHighlightSpecLength ||
    !Number.isSafeInteger(actualLineCount) ||
    actualLineCount <= 0
  ) {
    return [];
  }

  const rawParts = spec.split(",");
  if (rawParts.length > limits.maxHighlightRanges) return [];

  const parsed = [];
  for (const rawPart of rawParts) {
    const part = rawPart.trim();
    const match = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!match) return [];
    if (
      match[1].length > limits.maxHighlightDigitLength ||
      (match[2] && match[2].length > limits.maxHighlightDigitLength)
    ) {
      return [];
    }
    const first = Number(match[1]);
    const second = match[2] ? Number(match[2]) : first;
    if (!Number.isSafeInteger(first) || !Number.isSafeInteger(second))
      return [];
    const start = Math.max(1, Math.min(first, second));
    const end = Math.min(actualLineCount, Math.max(first, second));
    if (start > end) continue;
    if (end - start + 1 > limits.maxHighlightRangeLength) return [];
    parsed.push({ start, end });
  }

  parsed.sort(
    (left, right) => left.start - right.start || left.end - right.end,
  );
  const merged = [];
  for (const range of parsed) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end + 1) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }

  const covered = merged.reduce(
    (total, range) => total + range.end - range.start + 1,
    0,
  );
  if (
    merged.length > limits.maxHighlightRanges ||
    covered > limits.maxHighlightedLines
  ) {
    return [];
  }
  return merged;
}
