import type { ForumBasicInfo } from "@/lib/forum-name";

export default function ForumDisplay({ forum }: { forum: ForumBasicInfo }) {
  if (!forum.problem) return forum.name;

  return (
    <>
      <span
        className={`me-1 font-semibold text-luogu-problem-${forum.problem.difficulty}`}
      >
        {forum.problem.pid}
      </span>
      {forum.problem.title}
    </>
  );
}

export function ForumDisplayShort({ forum }: { forum: ForumBasicInfo }) {
  if (!forum.problem) return forum.name;

  return (
    <span className={`me-1 text-luogu-problem-${forum.problem.difficulty}`}>
      {forum.problem.pid}
    </span>
  );
}
