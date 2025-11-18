import React from "react";

import { Button } from "@/components/ui/button";

export default function DiscussionWriteReplyForm() {
  const [draft, setDraft] = React.useState("");

  const handleSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!draft.trim()) return;
      setDraft("");
    },
    [draft],
  );

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-3">
      <label className="flex flex-col gap-2">
        <span className="text-foreground text-sm font-medium">
          写下你的回复
        </span>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="参与讨论、分享你的解题技巧或补充新的思路..."
          className="border-border bg-muted/20 text-foreground focus:border-primary/60 focus:ring-primary/10 min-h-[120px] w-full resize-y rounded-2xl border px-4 py-3 text-sm shadow-inner outline-none transition focus:ring-4"
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="submit" className="rounded-xl px-4">
          发布回复
        </Button>
      </div>
    </form>
  );
}
