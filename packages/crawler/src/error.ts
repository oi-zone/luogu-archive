export class UnexpectedStatusError extends Error {
  constructor(
    message: string,
    public url: string,
    public status: number,
  ) {
    super(message);
  }
}

export class HttpError extends UnexpectedStatusError {
  constructor(
    url: string,
    status: number,
    public readonly retryAfterMs: number | null,
    public readonly category:
      | "http_status"
      | "response_too_large"
      | "invalid_content_type"
      | "invalid_json"
      | "timeout"
      | "network",
    message = "Upstream request failed",
  ) {
    super(message.slice(0, 256), url, status);
  }
}

export class AccessError extends UnexpectedStatusError {
  constructor(url: string, status: number) {
    super(`Access denied for ${url}`, url, status);
  }
}

export class UpstreamPayloadError extends Error {
  constructor(
    public readonly endpoint: string,
    message: string,
  ) {
    super(`${endpoint}: ${message}`.slice(0, 256));
  }
}
