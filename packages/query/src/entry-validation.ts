import type { EntryRef, EntryType } from "./entries.js";

export const MAX_ENTRY_REFS = 100;
export const MAX_ENTRY_INPUT_BYTES = 16 * 1024;

const ID_PATTERNS: Record<EntryType, RegExp> = {
  user: /^[1-9]\d{0,9}$/,
  discuss: /^[1-9]\d{0,9}$/,
  article: /^[a-z0-9]{8}$/,
  problem: /^[A-Za-z0-9_]{1,32}$/,
  paste: /^[a-z0-9]{8}$/,
};

export function parseEntryRef(value: string): EntryRef | null {
  if (value.length === 0 || value.length > 64) return null;
  const separator = value.indexOf(":");
  if (
    separator <= 0 ||
    separator !== value.lastIndexOf(":") ||
    separator === value.length - 1
  ) {
    return null;
  }

  const type = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (!Object.prototype.hasOwnProperty.call(ID_PATTERNS, type)) return null;
  const typedType = type as EntryType;
  if (!ID_PATTERNS[typedType].test(id)) return null;

  if (typedType === "user" || typedType === "discuss") {
    const numeric = Number(id);
    if (
      !Number.isSafeInteger(numeric) ||
      numeric <= 0 ||
      numeric > 2_147_483_647
    ) {
      return null;
    }
  }

  return { type: typedType, id } as EntryRef;
}

export function uniqueEntryRefs(refs: readonly EntryRef[]) {
  const seen = new Set<string>();
  const unique: EntryRef[] = [];
  for (const ref of refs) {
    const key = `${ref.type}:${ref.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(ref);
  }
  return unique;
}

export function validateEntryRequest(rawRefs: string[], inputBytes: number) {
  if (inputBytes > MAX_ENTRY_INPUT_BYTES) {
    return {
      ok: false as const,
      status: 413 as const,
      error: "Request too large",
    };
  }
  if (rawRefs.length > MAX_ENTRY_REFS) {
    return {
      ok: false as const,
      status: 400 as const,
      error: "Too many entry refs",
    };
  }
  const refs: EntryRef[] = [];
  for (const value of rawRefs) {
    const ref = parseEntryRef(value);
    if (!ref) {
      return {
        ok: false as const,
        status: 400 as const,
        error: "Invalid entry ref",
      };
    }
    refs.push(ref);
  }
  return { ok: true as const, refs };
}
