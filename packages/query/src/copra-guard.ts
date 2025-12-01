const ARTICLE_COPRA_SCHEMA_ERROR_CODES = new Set(["42P01", "42703"]);
let articleCopraJoinDisabled = false;
let articleCopraLogged = false;

export function shouldIncludeArticleCopra() {
  return !articleCopraJoinDisabled;
}

export function handleArticleCopraSchemaError(error: unknown, source: string) {
  if (!isArticleCopraSchemaError(error)) {
    return false;
  }

  articleCopraJoinDisabled = true;
  if (!articleCopraLogged) {
    articleCopraLogged = true;
    console.warn(
      `[${source}] ArticleCopra join disabled after schema error`,
      error instanceof Error ? error.message : error,
    );
  }
  return true;
}

function isArticleCopraSchemaError(error: unknown) {
  const code = extractPostgresErrorCode(error);
  return Boolean(code && ARTICLE_COPRA_SCHEMA_ERROR_CODES.has(code));
}

function extractPostgresErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { code?: unknown; cause?: unknown };
  if (typeof candidate.code === "string") {
    return candidate.code;
  }
  const { cause } = candidate;
  if (cause && typeof cause === "object") {
    const causeWithCode = cause as { code?: unknown };
    if (typeof causeWithCode.code === "string") {
      return causeWithCode.code;
    }
  }
  return null;
}
