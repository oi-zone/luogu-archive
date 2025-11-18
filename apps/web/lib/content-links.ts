export type LinkableContent = {
  type: string;
  id: string;
};

export function getContentHref(content: LinkableContent | null | undefined) {
  if (!content) {
    return null;
  }

  switch (content.type) {
    case "article":
      return `/a/${encodeURIComponent(content.id)}`;
    case "discussion":
      return `/d/${encodeURIComponent(content.id)}`;
    default:
      return null;
  }
}
