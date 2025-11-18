export type FeedItemType = "article" | "discussion" | "status";

export type FeedAuthor = {
  id: number;
  username: string;
  name: string;
  color: string;
  badge: string | null;
  ccfLevel: number;
  xcpcLevel: number;
  avatarUrl: string;
};

export type ArticleFeedItem = {
  id: string;
  type: "article";
  title: string;
  summary: string;
  replies: number;
  views: number;
  author: FeedAuthor;
  publishedAt: Date;
};

export type DiscussionFeedItem = {
  id: string;
  type: "discussion";
  title: string;
  summary: string;
  replies: number;
  views: number;
  author: FeedAuthor;
  publishedAt: Date;
};

export type StatusFeedItem = {
  id: string;
  type: "status";
  content: string;
  author: FeedAuthor;
  publishedAt: Date;
};

export type FeedItem = ArticleFeedItem | DiscussionFeedItem | StatusFeedItem;

export const TYPE_LABEL: Record<FeedItemType, string> = {
  article: "文章",
  discussion: "讨论",
  status: "动态",
};

export const TYPE_BADGE_CLASS: Record<FeedItemType, string> = {
  article: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  discussion: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  status: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
};

export const ABSOLUTE_DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat("zh-CN", {
  numeric: "auto",
});

const RELATIVE_TIME_DIVISIONS: {
  amount: number;
  unit: Intl.RelativeTimeFormatUnit;
}[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

const FAMILY_NAMES = [
  "陈",
  "李",
  "王",
  "张",
  "刘",
  "黄",
  "赵",
  "周",
  "吴",
  "徐",
] as const;
const GIVEN_NAME_PARTS = [
  "晨",
  "宇",
  "轩",
  "希",
  "瑜",
  "嘉",
  "诺",
  "逸",
  "然",
  "淼",
  "婧",
  "宁",
  "昕",
  "辰",
  "泽",
  "睿",
  "桐",
  "尧",
  "岚",
  "澜",
  "翊",
  "祺",
] as const;

const TITLE_OPENERS = [
  "跃动的",
  "轻盈的",
  "聚焦",
  "灵感",
  "热议",
  "精读",
  "前沿",
  "深潜",
] as const;
const TITLE_TOPICS = [
  "算法视角",
  "刷题之旅",
  "竞赛札记",
  "社区观点",
  "项目复盘",
  "实践手记",
  "图论花火",
  "组合数学",
] as const;

const SENTENCE_STARTS = [
  "最近",
  "本周",
  "这次",
  "也许",
  "或许",
  "在今天",
  "回顾",
  "我发现",
] as const;
const SENTENCE_THEMES = [
  "关于动态规划的细节",
  "一场有意思的讨论",
  "刷题时的反思",
  "和队友的默契",
  "社区里新的观点",
  "算法竞赛的节奏",
  "长期积累的心得",
  "对图论的再思考",
] as const;
const SENTENCE_ACTIONS = [
  "整理成了这份记录，",
  "尝试用简单的语言拆解，",
  "重新归纳了一遍，",
  "分享给大家，",
  "写成了随笔，",
  "放在这里交流，",
  "沉淀在这张卡片里，",
  "继续挖掘深层逻辑，",
] as const;
const SENTENCE_ENDINGS = [
  "希望能带来新的灵感。",
  "想听听你的想法。",
  "欢迎一起探讨。",
  "下次比赛见！",
  "也许会帮到同路人。",
  "欢迎收藏。",
  "这是一个新的起点。",
  "一起成长。",
] as const;

const STATUS_LINES = [
  "写完一套区间 DP 的题单，感觉状态终于回来了。",
  "今天在校队训练里打穿了一道几何题，夸夸自己。",
  "在社区里看到好多高质量题解，收藏夹又塞满了。",
  "把最近比赛的失误全部复盘，决定重新调整节奏。",
  "想邀请大家一起整理树形 DP 的模板和常见套路。",
  "准备开一个系列分享，从数据结构到算法设计。",
] as const;

export function formatRelativeTimeRaw(date: Date) {
  const diffInSeconds = Math.round((date.getTime() - Date.now()) / 1000);

  if (Math.abs(diffInSeconds) < 10) {
    return "刚刚";
  }

  let duration = diffInSeconds;
  for (const division of RELATIVE_TIME_DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return RELATIVE_TIME_FORMATTER.format(
        Math.round(duration),
        division.unit,
      );
    }
    duration /= division.amount;
  }

  return RELATIVE_TIME_FORMATTER.format(Math.round(duration), "year");
}

export function formatRelativeTime(date: Date) {
  const raw = formatRelativeTimeRaw(date);
  let result = raw[0];
  let isDigitLast = /^\d$/.test(raw[0]);

  for (let i = 1; i < raw.length; i++) {
    const isDigit = /^\d$/.test(raw[i]);
    if (isDigit !== isDigitLast) {
      result += "\u2009" + raw[i];
      isDigitLast = isDigit;
    } else {
      result += raw[i];
    }
  }
  return result;
}

export function generateFeedItem(): FeedItem {
  const type: FeedItemType = pickRandom(["article", "discussion", "status"]);
  const author = generateAuthor();
  const publishedAt = generatePublishedAt();

  if (type === "status") {
    return {
      id: createId(),
      type,
      author,
      publishedAt,
      content: generateStatusContent(),
    };
  }

  return {
    id: createId(),
    type,
    author,
    publishedAt,
    title: generateTitle(),
    summary: generateSummary(type === "article" ? 3 : 2),
    replies: getRandomInt(0, 320),
    views: getRandomInt(80, 12000),
  } as ArticleFeedItem | DiscussionFeedItem;
}

export function generateFeedItems(count: number): FeedItem[] {
  return Array.from({ length: count }, generateFeedItem);
}

function generateAuthor(): FeedAuthor {
  const family = pickRandom(FAMILY_NAMES);
  const given =
    pickRandom(GIVEN_NAME_PARTS) +
    (Math.random() > 0.6 ? pickRandom(GIVEN_NAME_PARTS) : "");
  const name = `${family}${given}`;
  const username = `user${Math.floor(Math.random() * 900000 + 100000)}`;

  return {
    id: 1,
    name,
    username,
    avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
      username,
    )}&backgroundColor=transparent`,
    color: pickRandom([
      "red",
      "blue",
      "green",
      "purple",
      "orange",
      "gray",
      "cheater",
    ]),
    badge:
      Math.random() > 0.7 ? pickRandom(["QwQ", "awa", "蒟蒻", "PM"]) : null,
    ccfLevel: Math.random() > 0.5 ? getRandomInt(3, 9) : 0,
    xcpcLevel: Math.random() > 0.5 ? getRandomInt(3, 9) : 0,
  };
}

function generatePublishedAt() {
  const now = Date.now();
  const pastOffset = getRandomInt(10 * 60 * 1000, 30 * 24 * 60 * 60 * 1000);
  return new Date(now - pastOffset);
}

function generateTitle() {
  return `${pickRandom(TITLE_OPENERS)} · ${pickRandom(TITLE_TOPICS)}`;
}

function generateSummary(sentenceCount: number) {
  return Array.from({ length: sentenceCount }, generateSentence).join(" ");
}

function generateSentence() {
  return (
    `${pickRandom(SENTENCE_STARTS)}${pickRandom(SENTENCE_THEMES)}` +
    `${pickRandom(SENTENCE_ACTIONS)}${pickRandom(SENTENCE_ENDINGS)}`
  );
}

function generateStatusContent() {
  const lines = getRandomInt(1, 2);
  const paragraphs = Array.from({ length: lines }, () =>
    pickRandom(STATUS_LINES),
  );
  return paragraphs.join("\n\n");
}

function pickRandom<T>(collection: readonly T[]): T {
  const index = Math.floor(Math.random() * collection.length);
  return collection[index];
}

function getRandomInt(min: number, max: number) {
  const lower = Math.ceil(min);
  const upper = Math.floor(max);
  return Math.floor(Math.random() * (upper - lower + 1)) + lower;
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
