import { RequestClient } from "@lgjs/request";

const cookie = process.env.LUOGU_COOKIE ?? null;
const userAgent =
  "LuoguDiscussionArchiveCrawler/0.1 (+https://github.com/piterator-org/luogu-discussion-archive)";

export const client = new RequestClient({
  baseUrl: "https://www.luogu.com",
  headers: {
    cookie,
    "x-luogu-type": "content-only",
    "user-agent": userAgent,
  },
});

export const clientLentille = new RequestClient({
  baseUrl: "https://www.luogu.com",
  headers: {
    cookie,
    "x-lentille-request": "content-only",
    "user-agent": userAgent,
  },
});

export const cn = new RequestClient({
  baseUrl: "https://www.luogu.com.cn",
  headers: {
    cookie,
    "x-lentille-request": "content-only",
    "user-agent": userAgent,
  },
});
