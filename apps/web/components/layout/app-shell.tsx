"use client";

import * as React from "react";
import {
  Clipboard,
  Compass,
  FileText,
  Gavel,
  Home,
  Layers,
  ListChecks,
  MessageSquare,
  MessagesSquare,
  Newspaper,
  PanelLeft,
  PenLine,
  Search,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  BreadcrumbProvider,
  useBreadcrumbContext,
  type BreadcrumbEntry,
} from "@/components/layout/breadcrumb-context";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const NAV_ITEMS = [
  {
    title: "首页",
    href: "/",
    icon: Home,
  },
  {
    title: "讨论",
    href: "/discussions",
    icon: MessagesSquare,
  },
  {
    title: "文章",
    href: "/articles",
    icon: Newspaper,
  },
  {
    title: "云剪贴板",
    href: "/pastes",
    icon: Clipboard,
  },
  // {
  //   title: "犇犇",
  //   href: "/benben",
  //   icon: PenLine,
  // },
  // {
  //   title: "团队",
  //   href: "/teams",
  //   icon: Compass,
  // },
  {
    title: "陶片放逐",
    href: "/ostraka",
    icon: Gavel,
  },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const pathname = usePathname();

  const handleOpenSidebar = React.useCallback(() => {
    setMobileSidebarOpen(true);
  }, []);

  const onNavigate = React.useCallback(() => {
    setMobileSidebarOpen(false);
  }, []);

  return (
    <div className="bg-background text-foreground">
      <DesktopSidebar pathname={pathname} />
      <MobileSidebar
        open={mobileSidebarOpen}
        onOpenChange={setMobileSidebarOpen}
        pathname={pathname}
        onNavigate={onNavigate}
      />
      <div
        className={cn(
          "flex min-h-svh flex-col transition-[margin-left] duration-300 ease-in-out",
          "md:ml-16",
        )}
      >
        <BreadcrumbProvider key={pathname}>
          <TopBar
            isMobile={isMobile}
            onOpenSidebar={handleOpenSidebar}
            pathname={pathname}
          />
          <div className="flex-1">{children}</div>
        </BreadcrumbProvider>
      </div>
    </div>
  );
}

function DesktopSidebar({ pathname }: { pathname: string }) {
  return (
    <div className="pointer-events-none fixed inset-y-0 left-0 z-40 hidden md:flex">
      <aside className="group/sidebar w-15.25 bg-background/80 pointer-events-auto flex h-full flex-col border-r px-2 py-6 shadow-sm backdrop-blur transition-[width] duration-300 ease-in-out hover:w-56">
        <div className="flex flex-1 flex-col gap-6 overflow-hidden">
          <SidebarBrand variant="desktop" />
          <nav className="space-y-1.5">
            {NAV_ITEMS.map((item) => (
              <DesktopNavItem
                key={item.href}
                item={item}
                active={isActive(pathname, item.href)}
              />
            ))}
          </nav>
        </div>
      </aside>
    </div>
  );
}

function DesktopNavItem({
  item,
  active,
}: {
  item: (typeof NAV_ITEMS)[number];
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group/nav focus-visible:ring-primary/30 focus-visible:ring-offset-background flex items-center overflow-hidden rounded-full p-3 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        active
          ? "bg-blue-500/85 text-white"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-5 shrink-0" size={20} aria-hidden />
      <span className={desktopLabelClass}>{item.title}</span>
    </Link>
  );
}

function MobileSidebar({
  open,
  onOpenChange,
  pathname,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 border-r p-0">
        <div className="flex h-full flex-col overflow-y-auto px-4 py-6">
          <SidebarBrand variant="mobile" />
          <nav className="mt-6 space-y-1.5">
            {NAV_ITEMS.map((item) => (
              <MobileNavItem
                key={item.href}
                item={item}
                active={isActive(pathname, item.href)}
                onNavigate={onNavigate}
              />
            ))}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MobileNavItem({
  item,
  active,
  onNavigate,
}: {
  item: (typeof NAV_ITEMS)[number];
  active: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "focus-visible:ring-primary/30 focus-visible:ring-offset-background flex items-center rounded-full p-3 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        active
          ? "bg-blue-500/85 text-white"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-5 shrink-0" size={20} aria-hidden />
      <span className="text-base/1 ml-3 whitespace-nowrap">{item.title}</span>
    </Link>
  );
}

function SidebarBrand({ variant }: { variant: "desktop" | "mobile" }) {
  return (
    <Link
      href="/"
      className={cn(
        "text-foreground hover:bg-muted/40 flex items-center rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
        variant === "desktop" && "pointer-events-none",
      )}
      tabIndex={variant === "desktop" ? -1 : 0}
    >
      <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-2xl text-lg font-bold">
        LG
      </div>
      {variant === "desktop" ? (
        <span className={desktopLabelClass}>洛谷仓库</span>
      ) : (
        <span className="ml-3 text-base">洛谷仓库</span>
      )}
    </Link>
  );
}

function TopBar({
  isMobile,
  onOpenSidebar,
  pathname,
}: {
  isMobile: boolean;
  onOpenSidebar: () => void;
  pathname: string;
}) {
  const { trail } = useBreadcrumbContext();
  const breadcrumbs = React.useMemo<BreadcrumbEntry[]>(
    () => trail ?? createBreadcrumbs(pathname),
    [pathname, trail],
  );
  const hideRootOnMobile = breadcrumbs.length > 1;

  return (
    <header className="bg-background/80 sticky top-0 z-30 border-b backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenSidebar}
            className="-ml-1"
          >
            <PanelLeft className="size-5" aria-hidden />
            <span className="sr-only">打开导航</span>
          </Button>
        )}
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              const itemClass = cn(
                "text-sm font-medium",
                index === 0 && hideRootOnMobile && "hidden sm:block",
              );

              return (
                <React.Fragment key={`${crumb.label}-${index}`}>
                  <BreadcrumbItem className={itemClass}>
                    {crumb.href && !isLast ? (
                      <BreadcrumbLink href={crumb.href}>
                        {crumb.label}
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                  {!isLast ? (
                    <BreadcrumbSeparator
                      className={
                        index === 0 && hideRootOnMobile
                          ? "hidden sm:block"
                          : undefined
                      }
                    />
                  ) : null}
                </React.Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <Button asChild variant="ghost" size="icon">
            <Link href="/queue" scroll={false}>
              <ListChecks className="size-5" aria-hidden />
              <span className="sr-only">查看保存队列</span>
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon">
            <Link href="/search" scroll={false}>
              <Search className="size-5" aria-hidden />
              <span className="sr-only">搜索</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname.startsWith(href);
}

function createBreadcrumbs(pathname: string): BreadcrumbEntry[] {
  const sanitized = pathname.split("?")[0]?.split("#")[0] ?? "/";
  const segments = sanitized.split("/").filter(Boolean);

  const crumbs: BreadcrumbEntry[] = [{ label: "首页", href: "/" }];

  if (segments.length === 0) {
    return crumbs;
  }

  const [first, second] = segments;

  switch (first) {
    case "status":
      crumbs.push({ label: "动态" });
      break;
    case "articles":
      crumbs.push({ label: "文章" });
      break;
    case "discussions":
      crumbs.push({ label: "讨论" });
      break;
    case "benben":
      crumbs.push({ label: "犇犇" });
      break;
    case "teams":
      crumbs.push({ label: "团队" });
      break;
    case "ostraka":
      crumbs.push({ label: "陶片放逐" });
      break;
    case "search":
      crumbs.push({ label: "站内搜索" });
      break;
    case "queue":
      crumbs.push({ label: "保存队列" });
      break;
    case "a": {
      crumbs.push({ label: "文章", href: "/articles" });
      if (second) {
        crumbs.push({ label: "文章详情" });
      }
      break;
    }
    case "d": {
      crumbs.push({ label: "讨论", href: "/discussions" });
      if (second) {
        crumbs.push({ label: "讨论详情" });
      }
      break;
    }
    default: {
      // Fallback to displaying the first segment in title case when not explicitly handled
      crumbs.push({ label: toTitleCase(first) });
      if (second) {
        crumbs.push({ label: decodeURIComponent(second) });
      }
      break;
    }
  }

  return crumbs;
}

function toTitleCase(value: string) {
  if (!value) return value;
  const lower = value.replace(/[-_]/g, " ");
  return lower.replace(/\b\w/g, (char) => char.toUpperCase());
}

const desktopLabelClass = cn(
  "ml-3 whitespace-nowrap text-base/1 transition-opacity duration-200 ease-in-out",
  "opacity-0 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100",
);
