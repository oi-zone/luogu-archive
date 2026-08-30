export const MAX_PUBLIC_REQUEST_INPUT_BYTES = 16 * 1024;
export const MAX_DATABASE_INTEGER_ID = 2_147_483_647;

export function requestInputIsTooLarge(request: Request) {
  return (
    new TextEncoder().encode(request.url).byteLength >
    MAX_PUBLIC_REQUEST_INPUT_BYTES
  );
}

export function parsePositiveDecimal(
  value: string,
  maximum = MAX_DATABASE_INTEGER_ID,
) {
  if (!/^[1-9]\d{0,9}$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maximum ? parsed : null;
}

export function parseNonNegativeDecimal(value: string, maximum = 10_000) {
  if (!/^(?:0|[1-9]\d{0,9})$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maximum ? parsed : null;
}

export function parseBoundedLimit(
  value: string | null,
  fallback: number,
  maximum: number,
) {
  if (value === null) return fallback;
  const parsed = parsePositiveDecimal(value, maximum);
  return parsed;
}

export function parseBase36Millis(value: string) {
  if (!/^[0-9a-z]{1,16}$/i.test(value)) return null;
  const parsed = Number.parseInt(value, 36);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return null;
  const date = new Date(parsed);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isArticleId(value: string) {
  return /^[a-z0-9]{8}$/.test(value);
}

export const isPasteId = isArticleId;

export function isBoundedCursor(value: string | null, maximumLength = 256) {
  return value === null || (value.length > 0 && value.length <= maximumLength);
}
