export interface BasicUserSnapshot {
  id: number;
  name: string;
  badge: string | null;
  color: string;
  ccfLevel: number;
  xcpcLevel: number;
}

export interface ForumProblemInfo {
  pid: string;
  title: string;
  difficulty: number | null;
}

export interface ForumBasicInfo {
  slug: string;
  name: string;
  problem: ForumProblemInfo | null;
}
