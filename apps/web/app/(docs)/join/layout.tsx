import type { ReactNode } from "react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "招贤纳才",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
