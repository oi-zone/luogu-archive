export const mentionRegexes = [
  /^luogu:\/\/user\/(\d+)$/,
  /^\/user\/(\d+)$/,
  /^\/space\/show\?uid=(\d+)$/,
];

export const discussionRegexes = [
  /^https:\/\/www.luogu.com.cn\/discuss\/(\d+)(?:\?.*)?(?:#.*)?$/,
  /^https:\/\/www.luogu.com\/discuss\/(\d+)(?:\?.*)?(?:#.*)?$/,
  /^https:\/\/www.luogu.com.cn\/discuss\/show\/(\d+)(?:\?.*)?(?:#.*)?$/,
  /^https:\/\/lglg.top\/(\d+)(?:\/.*)?(?:\?.*)?(?:#.*)?$/,
];

export const articleRegexes = [
  /^https:\/\/www.luogu.com.cn\/article\/([a-z0-9]{8})(\?.*)?(#.*)?$/,
  /^https:\/\/www.luogu.com\/article\/([a-z0-9]{8})(\?.*)?(#.*)?$/,
  /^https:\/\/www.luogu.me\/article\/([a-z0-9]{8})(\?.*)?(#.*)?$/,
];

export const userRegexes = [
  /^https:\/\/www.luogu.com.cn\/user\/(\d+)(?:\?.*)?(?:#.*)?$/,
  /^https:\/\/www.luogu.com\/user\/(\d+)(?:\?.*)?(?:#.*)?$/,
  /^https:\/\/www.luogu.com.cn\/space\/show\?uid=(\d+)(?:\?.*)?(?:#.*)?$/,
  /^https:\/\/lglg.top\/user\/(\d+)(?:\/.*)?(?:\?.*)?(?:#.*)?$/,
  /^https:\/\/www.luogu.me\/user\/(\d+)(?:\/.*)?(?:\?.*)?(?:#.*)?$/,
];

export const pasteRegexes = [
  /^https:\/\/www.luogu.com.cn\/paste\/([a-z0-9]{8})(?:\?.*)?(?:#.*)?$/,
  /^https:\/\/www.luogu.com\/paste\/([a-z0-9]{8})(?:\?.*)?(?:#.*)?$/,
  /^https:\/\/www.luogu.me\/paste\/([a-z0-9]{8})(?:\?.*)?(?:#.*)?$/,
];

export const problemRegexes = [
  /^https:\/\/www.luogu.com.cn\/problem\/([A-Za-z0-9_]+)(?:\?.*)?(?:#.*)?$/,
  /^https:\/\/www.luogu.com\/problem\/([A-Za-z0-9_]+)(?:\?.*)?(?:#.*)?$/,
];

export function captureFromFirstMatch(regexes: RegExp[], url: string) {
  for (const regex of regexes) {
    const match = regex.exec(url);
    if (match) return match;
  }
  return null;
}
