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
  constructor(url: string, status: number) {
    super(`Failed to fetch ${url}`, url, status);
  }
}

export class AccessError extends UnexpectedStatusError {
  constructor(url: string, status: number) {
    super(`Access denied for ${url}`, url, status);
  }
}
