import { Suspense } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";

import { cn } from "@/lib/utils";
import { AppShell } from "@/components/layout/app-shell";
import { QueryProvider } from "@/components/query/query-provider";
import { Umami } from "@/components/umami";
import UtmCleaner from "@/components/utm-cleaner";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "洛谷仓库",
    template: "%s - 洛谷仓库",
  },
  description: "洛谷仓库",
};

export default function RootLayout({
  children,
  modal,
}: React.PropsWithChildren<{
  modal?: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={cn(geistSans.variable, geistMono.variable, "antialiased")}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <AppShell>{children}</AppShell>
            {modal}
          </QueryProvider>
        </ThemeProvider>
      </body>
      {process.env.NODE_ENV === "production" && <Umami />}
      <Suspense>
        <UtmCleaner />
      </Suspense>
    </html>
  );
}
