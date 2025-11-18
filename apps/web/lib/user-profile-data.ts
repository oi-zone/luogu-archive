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

const HEADLINES = [
  "专注算法竞赛的全栈少年",
  "喜欢分享思路的 OIer",
  "图论与数据结构爱好者",
  "热衷写题解的洛谷编辑",
  "信息竞赛退役后继续写代码",
] as const;

const BIO_SENTENCES = [
  "热爱分享算法题解，也会写一些训练营日常。",
  "最近在准备省选，打算把错题整理成系列文章。",
  "偶尔会写点 React 和前端相关的内容，欢迎讨论。",
  "专注于树形 DP 与图论，也会关注社区的争议话题。",
  "喜欢参加翻译活动，维护题库质量。",
  "在学校担任信息社社长，带队参加比赛。",
  "目前主要在做数据结构专题的整理。",
  "希望和更多同好交流，一起进步。",
] as const;

const LOCATIONS = [
  "上海",
  "北京",
  "广州",
  "深圳",
  "杭州",
  "成都",
  "南京",
  "武汉",
] as const;

const TAGLINES = [
  "一起刷题一起飞",
  "OI 永不退役",
  "热血算法党",
  "题解写到秃头",
  "喜欢折腾 Web",
  "长期在线答疑",
] as const;

const USERNAME_SUFFIXES = [
  "min",
  "max",
  "plus",
  "alpha",
  "beta",
  "sigma",
  "delta",
  "nova",
  "spark",
  "core",
] as const;

const ARTICLE_TOPICS = [
  "树形 DP 解题指南",
  "组合数学沉思录",
  "图论比赛复盘",
  "线段树维护技巧",
  "动态规划踩坑记",
];
const DISCUSSION_TOPICS = [
  "CF 场次吐槽",
  "洛谷日报活动",
  "队内模拟赛总结",
  "省选备战交流",
  "模板题更新计划",
];
const ARTICLE_COMMENTS = [
  "补充一下在极端数据下的处理方法，建议加上取模判断。",
  "非常喜欢这篇文章的思路，特别是状态压缩那部分。",
  "觉得这里可以换成分层图建模，会更直观一些。",
  "如果把第二步拆成两个子问题，代码实现会更加清晰。",
];
const DISCUSSION_REPLIES = [
  "这波我赞同楼主，尤其是关于训练节奏的建议。",
  "我们队也是这么做的，效果确实好很多。",
  "我感觉还是应该先打基础再突击比赛。",
  "感谢分享资源，已经转给我们校队啦。",
];
const STATUS_LINES = [
  "今天趁着状态好整理完了省选真题的错题集。",
  "补完了最近三场 CF 的题解，准备录视频版。",
  "被一道计算几何卡了整整一天，终于搞定。",
  "和队友开了个训练营，欢迎来一起打卡。",
];
const OSTRAKA_REASONS = [
  "被举报在讨论区发布无关广告，官方警告一次。",
  "恶意刷屏被社区禁言 3 天。",
  "重复提交低质量题解，清理后提醒整改。",
];

const NAME_COLORS = [
  "purple",
  "red",
  "orange",
  "green",
  "blue",
  "gray",
  "cheater",
] as const;
export type UserNameColor = (typeof NAME_COLORS)[number];

export const NAME_COLOR_CLASS: Record<UserNameColor, string> = {
  purple: "text-luogu-purple",
  red: "text-luogu-red",
  orange: "text-luogu-orange",
  green: "text-luogu-green",
  blue: "text-luogu-blue",
  gray: "text-luogu-gray",
  cheater: "text-luogu-cheater",
};

const USER_BADGE_TAGS = [
  "洛谷日报投稿者",
  "官方翻译志愿者",
  "省选集训队成员",
  "信息社长",
  "算法摸鱼群活跃",
  "题解收藏家",
  "CF 红名选手",
  "NOIP 金牌",
];

export type UserProfile = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string;
  nameColor: UserNameColor;
  highlightTag?: string;
  ccfLevel?: number;
  xcpcLevel?: number;
  headline: string;
  bio: string;
  stats: {
    articles: number;
    discussions: number;
    statuses: number;
    followers: number;
    following: number;
  };
  joinDate: string;
  location: string;
  tags: string[];
};

export type UsernameHistoryEntry = {
  id: string;
  username: string;
  changedAt: string;
  note?: string;
};

export type RelatedUser = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string;
  headline: string;
  mutualTags: number;
  nameColor: UserNameColor;
  tag?: string;
  ccfLevel?: number;
};

export type TimelineEntry =
  | {
      id: string;
      type: "article";
      title: string;
      summary: string;
      href: string;
      reactions: number;
      comments: number;
      createdAt: string;
    }
  | {
      id: string;
      type: "discussion";
      title: string;
      summary: string;
      href: string;
      replies: number;
      participants: number;
      createdAt: string;
    }
  | {
      id: string;
      type: "articleComment";
      articleTitle: string;
      excerpt: string;
      href: string;
      createdAt: string;
    }
  | {
      id: string;
      type: "discussionReply";
      discussionTitle: string;
      excerpt: string;
      href: string;
      createdAt: string;
    }
  | {
      id: string;
      type: "status";
      content: string;
      createdAt: string;
    }
  | {
      id: string;
      type: "ostrakon";
      action: string;
      reason: string;
      createdAt: string;
    };

export type UserProfileBundle = {
  profile: UserProfile;
  usernameHistory: UsernameHistoryEntry[];
  related: RelatedUser[];
  timeline: TimelineEntry[];
};

export function generateUserProfileBundle(
  userId = createId(),
): UserProfileBundle {
  const profile = generateProfile(userId);
  const usernameHistory = generateUsernameHistory(profile.username);
  const related = generateRelatedUsers();
  const timeline = generateTimelineEntries();

  return {
    profile,
    usernameHistory,
    related,
    timeline,
  };
}

function generateProfile(id: string): UserProfile {
  const name = generateName();
  const username = generateUsername();
  const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(username)}`;

  return {
    id,
    name,
    username,
    avatarUrl,
    nameColor: pickRandom(NAME_COLORS),
    highlightTag: maybePick(USER_BADGE_TAGS),
    ccfLevel: maybeLevel(),
    headline: pickRandom(HEADLINES),
    bio: pickMultiple(BIO_SENTENCES, 2).join(" "),
    stats: {
      articles: getRandomInt(8, 48),
      discussions: getRandomInt(12, 72),
      statuses: getRandomInt(30, 240),
      followers: getRandomInt(120, 3200),
      following: getRandomInt(40, 360),
    },
    joinDate: daysAgo(getRandomInt(400, 2400)).toISOString(),
    location: pickRandom(LOCATIONS),
    tags: pickMultiple(TAGLINES, 3),
  };
}

function generateUsernameHistory(
  currentUsername: string,
): UsernameHistoryEntry[] {
  const entries: UsernameHistoryEntry[] = [];
  const total = getRandomInt(2, 5);
  let baseDaysAgo = getRandomInt(120, 2400);

  for (let index = total; index >= 1; index -= 1) {
    const username = `${currentUsername}${index === total ? "" : "_" + pickRandom(USERNAME_SUFFIXES)}`;
    entries.push({
      id: createId(),
      username,
      changedAt: daysAgo(baseDaysAgo).toISOString(),
      note: Math.random() > 0.7 ? "参加活动改名" : undefined,
    });
    baseDaysAgo -= getRandomInt(60, 360);
    if (baseDaysAgo < 20) {
      baseDaysAgo = getRandomInt(30, 120);
    }
  }

  entries.push({
    id: createId(),
    username: currentUsername,
    changedAt: new Date().toISOString(),
    note: "当前用户名",
  });

  return entries.sort(
    (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
  );
}

function generateRelatedUsers(): RelatedUser[] {
  return Array.from({ length: 6 }, () => {
    const username = generateUsername();
    return {
      id: createId(),
      name: generateName(),
      username,
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(username)}&backgroundColor=transparent`,
      headline: pickRandom(HEADLINES),
      mutualTags: getRandomInt(2, 8),
      nameColor: pickRandom(NAME_COLORS),
      tag: maybePick(USER_BADGE_TAGS),
      ccfLevel: maybeLevel(),
      xcpcLevel: maybeLevel(),
    };
  });
}

function generateTimelineEntries(): TimelineEntry[] {
  const generators: Array<() => TimelineEntry> = [
    generateArticleEntry,
    generateDiscussionEntry,
    generateArticleCommentEntry,
    generateDiscussionReplyEntry,
    generateStatusEntry,
    generateOstrakonEntry,
  ];

  return Array.from({ length: 16 }, (_, index) => {
    const entry = pickRandom(generators)();
    const offset = index * getRandomInt(6, 48);
    return {
      ...entry,
      createdAt: daysAgo(offset + getRandomInt(1, 12)).toISOString(),
    };
  }).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function generateArticleEntry(): TimelineEntry {
  return {
    id: createId(),
    type: "article",
    title: pickRandom(ARTICLE_TOPICS),
    summary: pickMultiple(BIO_SENTENCES, 1).join(" "),
    href: `/a/${randomId()}`,
    reactions: getRandomInt(12, 320),
    comments: getRandomInt(3, 80),
    createdAt: new Date().toISOString(),
  };
}

function generateDiscussionEntry(): TimelineEntry {
  return {
    id: createId(),
    type: "discussion",
    title: pickRandom(DISCUSSION_TOPICS),
    summary: pickRandom(BIO_SENTENCES),
    href: `/d/${randomId()}`,
    replies: getRandomInt(6, 120),
    participants: getRandomInt(3, 28),
    createdAt: new Date().toISOString(),
  };
}

function generateArticleCommentEntry(): TimelineEntry {
  return {
    id: createId(),
    type: "articleComment",
    articleTitle: pickRandom(ARTICLE_TOPICS),
    excerpt: pickRandom(ARTICLE_COMMENTS),
    href: `/a/${randomId()}#comments`,
    createdAt: new Date().toISOString(),
  };
}

function generateDiscussionReplyEntry(): TimelineEntry {
  return {
    id: createId(),
    type: "discussionReply",
    discussionTitle: pickRandom(DISCUSSION_TOPICS),
    excerpt: pickRandom(DISCUSSION_REPLIES),
    href: `/d/${randomId()}#reply`,
    createdAt: new Date().toISOString(),
  };
}

function generateStatusEntry(): TimelineEntry {
  return {
    id: createId(),
    type: "status",
    content: pickRandom(STATUS_LINES),
    createdAt: new Date().toISOString(),
  };
}

function generateOstrakonEntry(): TimelineEntry {
  return {
    id: createId(),
    type: "ostrakon",
    action: "社区处分记录",
    reason: pickRandom(OSTRAKA_REASONS),
    createdAt: new Date().toISOString(),
  };
}

function generateName() {
  const family = pickRandom(FAMILY_NAMES);
  const given =
    pickRandom(GIVEN_NAME_PARTS) +
    (Math.random() > 0.6 ? pickRandom(GIVEN_NAME_PARTS) : "");
  return `${family}${given}`;
}

function generateUsername() {
  return `user${Math.floor(Math.random() * 900000 + 100000)}`;
}

function pickRandom<T>(collection: readonly T[]): T {
  return collection[Math.floor(Math.random() * collection.length)];
}

function pickMultiple<T>(collection: readonly T[], count: number) {
  const result = new Set<T>();
  while (result.size < count) {
    result.add(pickRandom(collection));
  }
  return Array.from(result);
}

function maybePick<T>(collection: readonly T[]): T | undefined {
  return Math.random() > 0.5 ? pickRandom(collection) : undefined;
}

function maybeLevel() {
  return Math.random() > 0.5 ? getRandomInt(3, 9) : undefined;
}

function getRandomInt(min: number, max: number) {
  const lower = Math.ceil(min);
  const upper = Math.floor(max);
  return Math.floor(Math.random() * (upper - lower + 1)) + lower;
}

function daysAgo(days: number) {
  const now = new Date();
  now.setDate(now.getDate() - days);
  return now;
}

function randomId() {
  return Math.floor(Math.random() * 900000 + 100000).toString();
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
