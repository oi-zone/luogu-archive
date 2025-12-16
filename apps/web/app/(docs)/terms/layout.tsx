import type { ReactNode } from "react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "用户协议",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
