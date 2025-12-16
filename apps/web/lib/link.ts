export const mentionRegexes = [
  /^luogu:\/\/user\/(\d+)$/,
  /^\/user\/(\d+)$/,
  /^\/space\/show\?uid=(\d+)$/,
  /^https:\/\/www\.luogu\.com\.cn\/user\/(\d+)$/,
];

export const discussionRegexes = [
  /^https?:\/\/(?:www\.luogu\.com(?:\.cn)?|www\.luogu\.com\.co|www\.luogu\.me|(?:www\.)?luogu\.qzz\.io|luogu\.gengen\.qzz\.io|lg\.gengen\.qzz\.io)\/discuss\/(\d+)\/?(?:\?.*)?(?:#.*)?$/,
  /^https?:\/\/www\.luogu\.com\.cn\/discuss\/show\/(\d+)\/?(?:\?.*)?(?:#.*)?$/,
  /^https?:\/\/lglg\.top\/(\d+)(?:\/.*)?(?:\?.*)?(?:#.*)?$/,
  /^https?:\/\/luogu\.store\/d\/(\d+)(?:@([a-z0-9]+))?(?:\?.*)?(?:#.*)?$/,
];

export const articleRegexes = [
  /^https?:\/\/(?:www\.luogu\.com(?:\.cn)?|www\.luogu\.com\.co|www\.luogu\.me|(?:www\.)?luogu\.qzz\.io|luogu\.gengen\.qzz\.io|lg\.gengen\.qzz\.io)\/article\/([a-z0-9]{8})\/?(\?.*)?(#.*)?$/,
  /^https?:\/\/luogu\.store\/a\/([a-z0-9]{8})(?:@([a-z0-9]+))?(?:\?.*)?(?:#.*)?$/,
];

export const userRegexes = [
  /^https?:\/\/(?:www\.luogu\.com(?:\.cn)?|www\.luogu\.com\.co|www\.luogu\.me|(?:www\.)?luogu\.qzz\.io|luogu\.gengen\.qzz\.io|lg\.gengen\.qzz\.io)\/user\/(\d+)\/?(?:\?.*)?(?:#.*)?$/,
  /^https?:\/\/www\.luogu\.com\.cn\/space\/show\?uid=(\d+)(?:\?.*)?(?:#.*)?$/,
  /^https?:\/\/lglg\.top\/user\/(\d+)(?:\/.*)?(?:\?.*)?(?:#.*)?$/,
  /^https?:\/\/luogu\.store\/u\/(\d+)(?:\?.*)?(?:#.*)?$/,
];

export const pasteRegexes = [
  /^https?:\/\/(?:www\.luogu\.com(?:\.cn)?|www\.luogu\.com\.co|www\.luogu\.me|(?:www\.)?luogu\.qzz\.io|luogu\.gengen\.qzz\.io|lg\.gengen\.qzz\.io)\/paste\/([a-z0-9]{8})\/?(?:\?.*)?(?:#.*)?$/,
  /^https?:\/\/luogu\.store\/p\/([a-z0-9]{8})(?:@([a-z0-9]+))?(?:\?.*)?(?:#.*)?$/,
];

export const problemRegexes = [
  /^https?:\/\/www\.luogu\.com\.cn\/problem\/([A-Za-z0-9_]+)(?:\?.*)?(?:#.*)?$/,
];

export const judgementRegexes = [
  /^https?:\/\/(?:www\.luogu\.com\.cn|www\.luogu\.me)\/judgement(?:\?.*)?(?:#.*)?$/,
  /^https?:\/\/lglg\.top\/judgement(?:\?.*)?(?:#.*)?$/,
  /^https?:\/\/luogu\.store\/judgement(?:\?.*)?(?:#.*)?$/,
];

export function captureFromFirstMatch(regexes: RegExp[], url: string) {
  for (const regex of regexes) {
    const match = regex.exec(url);
    if (match) return match;
  }
  return null;
}
