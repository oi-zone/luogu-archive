export const mentionRegexes = [
  /^luogu:\/\/user\/(\d+)$/,
  /^\/user\/(\d+)$/,
  /^\/space\/show\?uid=(\d+)$/,
];

export const discussionRegexes = [
  /^https?:\/\/(?:www\.luogu\.com(?:\.cn)?|www\.luogu\.me|(?:www\.)?luogu\.qzz\.io|luogu\.gengen\.qzz\.io|lg\.gengen\.qzz\.io)\/discuss\/(\d+)\/?(?:\?.*)?(?:#.*)?$/,
  /^https?:\/\/www\.luogu\.com\.cn\/discuss\/show\/(\d+)\/?(?:\?.*)?(?:#.*)?$/,
  /^https?:\/\/lglg\.top\/(\d+)(?:\/.*)?(?:\?.*)?(?:#.*)?$/,
];

export const articleRegexes = [
  /^https?:\/\/(?:www\.luogu\.com(?:\.cn)?|www\.luogu\.me|(?:www\.)?luogu\.qzz\.io|luogu\.gengen\.qzz\.io|lg\.gengen\.qzz\.io)\/article\/([a-z0-9]{8})\/?(\?.*)?(#.*)?$/,
];

export const userRegexes = [
  /^https?:\/\/(?:www\.luogu\.com(?:\.cn)?|www\.luogu\.me|(?:www\.)?luogu\.qzz\.io|luogu\.gengen\.qzz\.io|lg\.gengen\.qzz\.io)\/user\/(\d+)\/?(?:\?.*)?(?:#.*)?$/,
  /^https?:\/\/www\.luogu\.com\.cn\/space\/show\?uid=(\d+)(?:\?.*)?(?:#.*)?$/,
  /^https?:\/\/lglg\.top\/user\/(\d+)(?:\/.*)?(?:\?.*)?(?:#.*)?$/,
];

export const pasteRegexes = [
  /^https?:\/\/(?:www\.luogu\.com(?:\.cn)?|www\.luogu\.me|(?:www\.)?luogu\.qzz\.io|luogu\.gengen\.qzz\.io|lg\.gengen\.qzz\.io)\/paste\/([a-z0-9]{8})\/?(?:\?.*)?(?:#.*)?$/,
];

export const problemRegexes = [
  /^https?:\/\/www\.luogu\.com\.cn\/problem\/([A-Za-z0-9_]+)(?:\?.*)?(?:#.*)?$/,
];

export function captureFromFirstMatch(regexes: RegExp[], url: string) {
  for (const regex of regexes) {
    const match = regex.exec(url);
    if (match) return match;
  }
  return null;
}
