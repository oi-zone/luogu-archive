export const JUDGEMENT_PERMISSIONS = [
  { id: 1, name: "登录鉴权" },
  { id: 2, name: "进入主站" },
  { id: 4, name: "进入后台" },
  { id: 8, name: "题目管理" },
  { id: 16, name: "团队管理" },
  { id: 32, name: "比赛管理" },
  { id: 64, name: "秩序管理" },
  { id: 128, name: "百科管理" },
  { id: 256, name: "用户管理" },
  { id: 512, name: "博客管理" },
  { id: 32768, name: "自由发言" },
  { id: 65536, name: "发送私信" },
  { id: 131072, name: "使用博客" },
  { id: 524288, name: "使用图床" },
  { id: 1073741824, name: "超级用户" },
];

export const getPermissionNames = (permission: number) => {
  return JUDGEMENT_PERMISSIONS.filter(
    (perm) => (perm.id & permission) === perm.id,
  ).map((perm) => perm.name);
};
