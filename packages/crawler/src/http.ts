import { HttpError, UpstreamPayloadError } from "./error.js";

export interface JsonResponsePolicy<T> {
  endpoint: string;
  timeoutMs: number;
  maxBytes: number;
  validate: (value: unknown) => T;
}

export interface SafeJsonResult<T> {
  data: T;
  status: number;
  url: string;
}

const MIN_RETRY_AFTER_MS = 1_000;
const MAX_RETRY_AFTER_MS = 15 * 60 * 1000;

export function parseRetryAfter(
  value: string | null,
  now = Date.now(),
): number | null {
  if (!value || value.length > 128) return null;
  const seconds = Number(value);
  const duration = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(value) - now;
  if (!Number.isFinite(duration) || duration < 0) return null;
  return Math.min(
    MAX_RETRY_AFTER_MS,
    Math.max(MIN_RETRY_AFTER_MS, Math.round(duration)),
  );
}

async function cancelBody(response: Response) {
  try {
    await response.body?.cancel();
  } catch {
    // The connection may already be closed. Nothing sensitive is retained.
  }
}

function isJsonContentType(value: string | null) {
  if (!value) return false;
  const mediaType = value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return mediaType === "application/json" || mediaType.endsWith("+json");
}

async function readBoundedBody(response: Response, maximum: number) {
  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const declared = Number.parseInt(contentLength, 10);
    if (Number.isFinite(declared) && declared > maximum) {
      await cancelBody(response);
      throw new HttpError(
        response.url,
        response.status,
        null,
        "response_too_large",
        "Upstream response exceeds the configured byte limit",
      );
    }
  }

  if (!response.body) return new Uint8Array();

  const output = new Uint8Array(maximum + 1);
  const reader = response.body.getReader();
  let offset = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (offset + value.byteLength > maximum) {
        await reader.cancel();
        throw new HttpError(
          response.url,
          response.status,
          null,
          "response_too_large",
          "Upstream response exceeds the configured byte limit",
        );
      }
      output.set(value, offset);
      offset += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  return output.subarray(0, offset);
}

export async function requestJson<T>(
  request: (signal: AbortSignal) => Promise<Response>,
  policy: JsonResponsePolicy<T>,
): Promise<SafeJsonResult<T>> {
  let response: Response;
  try {
    response = await request(AbortSignal.timeout(policy.timeoutMs));
  } catch (error) {
    const timedOut =
      error instanceof DOMException &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    throw new HttpError(
      policy.endpoint,
      0,
      null,
      timedOut ? "timeout" : "network",
      timedOut
        ? "Upstream request timed out"
        : "Upstream network request failed",
    );
  }

  if (!response.ok) {
    const parsedRetryAfter = parseRetryAfter(
      response.headers.get("retry-after"),
    );
    // A missing or malformed 429 header still enters BullMQ's manual limiter
    // for the minimum safe delay instead of hot-looping through normal retries.
    const retryAfterMs =
      response.status === 429
        ? (parsedRetryAfter ?? MIN_RETRY_AFTER_MS)
        : parsedRetryAfter;
    await cancelBody(response);
    throw new HttpError(
      response.url,
      response.status,
      retryAfterMs,
      "http_status",
      `Upstream returned HTTP ${String(response.status)}`,
    );
  }

  if (!isJsonContentType(response.headers.get("content-type"))) {
    await cancelBody(response);
    throw new HttpError(
      response.url,
      response.status,
      null,
      "invalid_content_type",
      "Upstream response is not JSON",
    );
  }

  const bytes = await readBoundedBody(response, policy.maxBytes);
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
  } catch {
    throw new HttpError(
      response.url,
      response.status,
      null,
      "invalid_json",
      "Upstream returned invalid JSON",
    );
  }

  try {
    return {
      data: policy.validate(parsed),
      status: response.status,
      url: response.url,
    };
  } catch (error) {
    if (error instanceof UpstreamPayloadError) throw error;
    throw new UpstreamPayloadError(policy.endpoint, "invalid response shape");
  }
}

export function expectRecord(
  value: unknown,
  endpoint: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new UpstreamPayloadError(endpoint, "expected an object");
  }
  return value as Record<string, unknown>;
}

export function expectArray<T>(
  value: unknown,
  endpoint: string,
  maximum: number,
): T[] {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new UpstreamPayloadError(endpoint, "invalid or oversized array");
  }
  return value as T[];
}

export function expectFiniteNumber(value: unknown, endpoint: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new UpstreamPayloadError(endpoint, "expected a finite number");
  }
  return value;
}

export function expectString(
  value: unknown,
  endpoint: string,
  maximumLength: number,
) {
  if (typeof value !== "string" || value.length > maximumLength) {
    throw new UpstreamPayloadError(endpoint, "invalid string");
  }
  return value;
}
