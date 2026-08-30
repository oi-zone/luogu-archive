import type { Config, Route } from "@lgjs/types";

import { UpstreamPayloadError } from "./error.js";
import {
  expectRecord,
  expectString,
  requestJson,
  type JsonResponsePolicy,
  type SafeJsonResult,
} from "./http.js";

const userAgent =
  "LuoguDiscussionArchiveCrawler/0.1 (+https://github.com/piterator-org/luogu-discussion-archive)";

type Primitive = string | number | boolean;
interface RequestOptions {
  params?: Record<string, Primitive>;
  query?: Record<string, Primitive | null | undefined>;
}

const configPromises = new Map<string, Promise<Config>>();

function expandTemplate(template: string, params: Record<string, Primitive>) {
  return Object.entries(params).reduce(
    (result, [key, value]) =>
      result
        .replace(`{${key}}`, encodeURIComponent(value))
        .replace(`:${key}`, encodeURIComponent(value)),
    template,
  );
}

function validateConfig(value: unknown): Config {
  const config = expectRecord(value, "route.config");
  const routes = expectRecord(config.route, "route.config");
  const entries = Object.entries(routes);
  if (entries.length === 0 || entries.length > 512) {
    throw new Error("Invalid route config size");
  }
  for (const [, route] of entries) expectString(route, "route.config", 512);
  return config as unknown as Config;
}

async function getConfig(baseUrl: string) {
  const cached = configPromises.get(baseUrl);
  if (cached) return cached;
  const pending = requestJson(
    (signal) =>
      fetch(`${baseUrl}/_lfe/config`, {
        signal,
        headers: { "user-agent": userAgent },
      }),
    {
      endpoint: "route.config",
      timeoutMs: 10_000,
      maxBytes: 256 * 1024,
      validate: validateConfig,
    },
  )
    .then(({ data }) => data)
    .catch((error: unknown) => {
      configPromises.delete(baseUrl);
      throw error;
    });
  configPromises.set(baseUrl, pending);
  return pending;
}

export class PublicRequestClient {
  private readonly origin: string;

  constructor(
    private readonly options: {
      baseUrl: string;
      headers: Record<string, string>;
    },
  ) {
    this.origin = new URL(options.baseUrl).origin;
  }

  async getJson<T>(
    routeName: Route,
    options: RequestOptions,
    policy: JsonResponsePolicy<T>,
  ): Promise<SafeJsonResult<T>> {
    const config = await getConfig(this.options.baseUrl);
    const template = config.route[routeName];
    if (!template) throw new Error(`Unknown upstream route ${routeName}`);
    const path = expandTemplate(template, options.params ?? {});
    const url = new URL(path, this.options.baseUrl);
    if (url.origin !== this.origin) {
      throw new UpstreamPayloadError(
        policy.endpoint,
        "route config attempted a cross-origin request",
      );
    }
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== null && value !== undefined)
        url.searchParams.set(key, String(value));
    }

    return requestJson(
      (signal) =>
        fetch(url, {
          method: "GET",
          headers: this.options.headers,
          signal,
        }),
      policy,
    );
  }
}

// Archive requests intentionally carry no LUOGU_COOKIE. Publicly derived IDs can
// therefore never acquire account-level access at the upstream boundary.
export const publicClient = new PublicRequestClient({
  baseUrl: "https://www.luogu.com",
  headers: {
    "x-luogu-type": "content-only",
    "user-agent": userAgent,
  },
});

export const publicLentille = new PublicRequestClient({
  baseUrl: "https://www.luogu.com",
  headers: {
    "x-lentille-request": "content-only",
    "user-agent": userAgent,
  },
});

export const publicCn = new PublicRequestClient({
  baseUrl: "https://www.luogu.com.cn",
  headers: {
    Accept: "application/json",
    "user-agent": userAgent,
  },
});
