import { RequestClient } from "@lgjs/request";

export const client = new RequestClient({
  baseUrl: "https://www.luogu.com",
  headers: {
    cookie: process.env.LUOGU_COOKIE ?? null,
    "x-lentille-request": "content-only",
    "user-agent":
      "LuoguDiscussionArchiveCrawler/0.1 (+https://github.com/piterator-org/luogu-discussion-archive)",
  },
});
