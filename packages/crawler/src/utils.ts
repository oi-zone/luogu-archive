export const deduplicate = <T>(
  arr: T[],
  getKey: (item: T) => string | number,
): T[] =>
  [...new Map(arr.map((item) => [getKey(item), item])).values()].sort(
    (a, b) => {
      const keyA = getKey(a);
      const keyB = getKey(b);
      if (typeof keyA === "number" && typeof keyB === "number")
        return keyA - keyB;
      return String(keyA).localeCompare(String(keyB));
    },
  );
