import type { ConnectionOptions, JobsOptions } from "bullmq";

const queueNamePrefix = (() => {
  const value = process.env.QUEUE_NAME_PREFIX ?? "";
  if (value && !/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
    throw new Error("QUEUE_NAME_PREFIX contains unsafe characters");
  }
  return value;
})();

export const REFRESH_QUEUE_NAME = `${queueNamePrefix}luogu-refresh`;
export const BACKFILL_QUEUE_NAME = `${queueNamePrefix}luogu-backfill`;
export const LEGACY_QUEUE_NAME = `${queueNamePrefix}luogu-crawler`;

export function boundedInteger(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, value));
}

export const REFRESH_QUEUE_MAX_DEPTH = boundedInteger(
  "REFRESH_QUEUE_MAX_DEPTH",
  5_000,
  100,
  1_000_000,
);
export const BACKFILL_QUEUE_MAX_DEPTH = boundedInteger(
  "BACKFILL_QUEUE_MAX_DEPTH",
  10_000,
  100,
  1_000_000,
);

export function runnablePressureDepth(counts: {
  wait: number;
  active: number;
  delayed: number;
  prioritized: number;
}) {
  return counts.wait + counts.active + counts.delayed + counts.prioritized;
}

export const COMPLETED_RETENTION = {
  age: boundedInteger("QUEUE_COMPLETED_RETENTION_SECONDS", 3_600, 60, 86_400),
  count: boundedInteger("QUEUE_COMPLETED_RETENTION_COUNT", 1_000, 10, 100_000),
} as const;

export const FAILED_RETENTION = {
  age: boundedInteger(
    "QUEUE_FAILED_RETENTION_SECONDS",
    7 * 24 * 60 * 60,
    3_600,
    30 * 24 * 60 * 60,
  ),
  count: boundedInteger("QUEUE_FAILED_RETENTION_COUNT", 5_000, 10, 100_000),
} as const;

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: boundedInteger("QUEUE_JOB_ATTEMPTS", 5, 1, 20),
  backoff: {
    type: "exponential",
    delay: boundedInteger("QUEUE_BACKOFF_DELAY_MS", 5_000, 100, 300_000),
    jitter: 0.5,
  },
  removeOnComplete: COMPLETED_RETENTION,
  removeOnFail: FAILED_RETENTION,
  keepLogs: 20,
  stackTraceLimit: 5,
  sizeLimit: 16 * 1024,
};

export function redisConnection(): ConnectionOptions {
  const configuredUrl = process.env.REDIS_URL;
  if (configuredUrl) {
    const url = new URL(configuredUrl);
    if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
      throw new Error("REDIS_URL must use redis:// or rediss://");
    }
    const dbPath = url.pathname.replace(/^\//, "");
    return {
      host: url.hostname,
      port: url.port ? Number.parseInt(url.port, 10) : 6379,
      ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
      ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
      db: dbPath ? Number.parseInt(dbPath, 10) : 0,
      ...(url.protocol === "rediss:" ? { tls: {} } : {}),
      maxRetriesPerRequest: null,
    };
  }

  return {
    host: process.env.REDIS_HOST ?? "127.0.0.1",
    port: boundedInteger("REDIS_PORT", 6379, 1, 65_535),
    ...(process.env.REDIS_USERNAME
      ? { username: process.env.REDIS_USERNAME }
      : {}),
    ...(process.env.REDIS_PASSWORD
      ? { password: process.env.REDIS_PASSWORD }
      : {}),
    db: boundedInteger("REDIS_DB", 0, 0, 15),
    ...(process.env.REDIS_TLS === "true" ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}
