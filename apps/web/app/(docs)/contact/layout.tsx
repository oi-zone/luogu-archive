import type { ReactNode } from "react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "联系我们",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
