import * as React from "react";

import type { CommentCardProps } from "@/components/comments/comment-card";

type Mapper<T> = (input: T) => CommentCardProps;

type CommentCollectionResult<T> = {
  items: CommentCardProps[];
  replaceAll: (entries: T[]) => void;
  appendUnique: (entries: T[]) => number;
  prependUnique: (entries: T[]) => number;
  clear: () => void;
};

// Maintains a deduplicated comment list mapped from DTO entries.
export function useCommentCollection<T>(
  mapToComment: Mapper<T>,
): CommentCollectionResult<T> {
  const [items, setItems] = React.useState<CommentCardProps[]>([]);
  const idSetRef = React.useRef(new Set<number>());

  const replaceAll = React.useCallback(
    (entries: T[]) => {
      if (entries.length === 0) {
        idSetRef.current = new Set();
        setItems([]);
        return;
      }

      const mapped = entries.map(mapToComment);
      idSetRef.current = new Set(mapped.map((entry) => entry.comment.id));
      setItems(mapped);
    },
    [mapToComment],
  );

  const appendUnique = React.useCallback(
    (entries: T[]) => {
      if (entries.length === 0) return 0;
      let appendedCount = 0;

      setItems((prev) => {
        if (prev.length === 0) {
          const mapped = entries.map(mapToComment);
          appendedCount = mapped.length;
          idSetRef.current = new Set(mapped.map((entry) => entry.comment.id));
          return mapped;
        }

        const existingIds = new Set(idSetRef.current);
        const next = [...prev];

        entries.forEach((entry) => {
          const mapped = mapToComment(entry);
          const commentId = mapped.comment.id;

          if (existingIds.has(commentId)) return;
          existingIds.add(commentId);
          next.push(mapped);
          appendedCount += 1;
        });

        if (appendedCount > 0) {
          idSetRef.current = existingIds;
          return next;
        }

        return prev;
      });

      return appendedCount;
    },
    [mapToComment],
  );

  const prependUnique = React.useCallback(
    (entries: T[]) => {
      if (entries.length === 0) return 0;
      let appendedCount = 0;

      setItems((prev) => {
        if (prev.length === 0) {
          const mapped = entries.map(mapToComment);
          appendedCount = mapped.length;
          idSetRef.current = new Set(mapped.map((entry) => entry.comment.id));
          return mapped;
        }

        const existingIds = new Set(idSetRef.current);
        const head: CommentCardProps[] = [];

        entries.forEach((entry) => {
          const mapped = mapToComment(entry);
          const commentId = mapped.comment.id;

          if (existingIds.has(commentId)) return;
          existingIds.add(commentId);
          head.push(mapped);
        });

        if (head.length === 0) {
          appendedCount = 0;
          return prev;
        }

        appendedCount = head.length;
        idSetRef.current = existingIds;
        return [...head, ...prev];
      });

      return appendedCount;
    },
    [mapToComment],
  );

  const clear = React.useCallback(() => {
    idSetRef.current = new Set();
    setItems([]);
  }, []);

  return React.useMemo(
    () => ({ items, replaceAll, appendUnique, prependUnique, clear }),
    [appendUnique, clear, items, prependUnique, replaceAll],
  );
}
