export type CategoryInfo = {
  name: string;
};

const categoryToName: Record<number, string> = {
  1: "个人记录",
  2: "题解",
  3: "科技·工程",
  4: "算法·理论",
  5: "生活·游记",
  6: "学习·文化课",
  7: "休闲·娱乐",
};

export function getCategoryInfo(category: number): CategoryInfo {
  return {
    name: categoryToName[category] || "未知分类\u2009" + category.toString(),
  };
}
