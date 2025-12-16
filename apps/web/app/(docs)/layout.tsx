import type { ReactNode } from "react";

import "@/components/markdown/markdown.css";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 justify-center px-4 py-10 sm:px-6 lg:px-8">
      <article className="w-full max-w-4xl">
        <div className="markdown-body">{children}</div>
      </article>
    </div>
  );
}
