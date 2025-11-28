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
  constructor(public response: Response) {
    super(`Failed to fetch ${response.url}`, response.url, response.status);
  }
}

export class AccessError extends UnexpectedStatusError {
  constructor(url: string, status: number) {
    super(`Access denied for ${url}`, url, status);
  }
}
