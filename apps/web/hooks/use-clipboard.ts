"use client";

import { useCallback, useState } from "react";

function fallbackCopyText(text: string) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(ta);
  if (!ok) throw new Error("execCommand copy failed");
}

export function useClipboard(timeout = 1500) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const copy = useCallback(
    async (text: string) => {
      try {
        if (
          typeof navigator !== "undefined" &&
          navigator.clipboard?.writeText
        ) {
          await navigator.clipboard.writeText(text);
        } else {
          fallbackCopyText(text);
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), timeout);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        setError(e);
      }
    },
    [timeout],
  );

  return { copy, copied, error };
}
