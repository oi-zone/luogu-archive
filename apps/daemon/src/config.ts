export const GROUP_NAME = "crawlers";

export const BLOCK_IMMEDIATE_MS = 1000;

export const REPLY_PAGE_CACHE_TTL_SEC = 300;

// Maximum number of attempts for a job before giving up and rethrowing the error
export const JOB_MAX_ATTEMPTS = 4;
// Base delay (ms) between retries; used with attempt number to give a small backoff
export const JOB_RETRY_DELAY_MS = 2000;
