export function normalizeCopraTags(raw: unknown): string[] | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  const value = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? safeParseArray(raw)
      : null;

  if (!value) {
    return null;
  }

  const tags = value
    .map((item) => (typeof item === "string" ? item.trim() : null))
    .filter((item): item is string => Boolean(item?.length));

  return tags.length ? tags : null;
}

function safeParseArray(raw: string): unknown[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
