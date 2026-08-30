export type HighlightRange = { start: number; end: number };

export const MARKDOWN_SECURITY_LIMITS: Readonly<{
  maxDocumentBytes: number;
  maxCodeBlockBytes: number;
  maxCodeBlockPreviewChars: number;
  maxCodeBlockLines: number;
  maxTableRows: number;
  maxTableColumns: number;
  maxDirectiveDepth: number;
  maxMagicLinks: number;
  maxLinkUrlLength: number;
  maxLinkLabelLength: number;
  maxLinkSourceLength: number;
  maxHighlightRanges: number;
  maxHighlightRangeLength: number;
  maxHighlightedLines: number;
  maxHighlightDigitLength: number;
  maxHighlightSpecLength: number;
  maxPlainTextPreviewChars: number;
}>;

export function utf8ByteLength(value: string): number;
export function utf8ByteLengthExceeds(value: string, maximum: number): boolean;
export function parseHighlightRanges(
  spec: string | null | undefined,
  actualLineCount: number,
): HighlightRange[];
