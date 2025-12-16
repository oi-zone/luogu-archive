"use client";

import * as React from "react";
import {
  Gavel,
  Home,
  Layers,
  ListChecks,
  PanelLeft,
  Search,
  Telescope,
} from "lucide-react";
import Image from "next/image";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AppFooter } from "@/components/layout/app-footer";
import {
  BreadcrumbProvider,
  useBreadcrumbContext,
  type BreadcrumbEntry,
} from "@/components/layout/breadcrumb-context";
import { ThemeToggle } from "@/components/theme/theme-toggle";

import piterator from "../../app/piterator.svg";

const NAV_ITEMS = [
  {
    title: "首页",
    href: "/",
    icon: Home,
  },
  {
    title: "探索",
    href: "/explore",
    icon: Telescope,
  },
  {
    title: "最近",
    href: "/recent",
    icon: Layers,
  },
  {
    title: "陶片放逐",
    href: "/judgement",
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
          "md:ml-15.25",
        )}
      >
        <BreadcrumbProvider key={pathname}>
          <TopBar
            isMobile={isMobile}
            onOpenSidebar={handleOpenSidebar}
            pathname={pathname}
          />
          <div className="flex-1">{children}</div>
          <AppFooter className="mt-8" />
        </BreadcrumbProvider>
      </div>
    </div>
  );
}

function DesktopSidebar({ pathname }: { pathname: string }) {
  return (
    <div className="pointer-events-none fixed inset-y-0 left-0 z-40 hidden md:flex">
      <aside className="group/sidebar pointer-events-auto flex h-full w-15.25 flex-col border-r bg-background/80 px-2 py-6 shadow-sm backdrop-blur transition-[width] duration-300 ease-in-out hover:w-56">
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
        "group/nav flex items-center overflow-hidden rounded-full p-3 text-sm transition-colors duration-200 focus-visible:text-foreground focus-visible:outline-none",
        active
          ? "bg-indigo-500/85 !text-white"
          : "text-muted-foreground hover:bg-muted/85 hover:text-foreground",
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
        <SheetHeader className="sr-only">
          <SheetTitle>导航菜单</SheetTitle>
        </SheetHeader>
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
        "flex items-center rounded-full p-3 text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
        active
          ? "bg-indigo-500/85 text-white"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-5 shrink-0" size={20} aria-hidden />
      <span className="ml-3 text-base/1 whitespace-nowrap">{item.title}</span>
    </Link>
  );
}

function SidebarBrand({ variant }: { variant: "desktop" | "mobile" }) {
  return (
    <Link
      href="/"
      className={cn(
        "flex items-center rounded-xl px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted/40",
        variant === "desktop" && "pointer-events-none",
      )}
      tabIndex={variant === "desktop" ? -1 : 0}
    >
      <Image src={piterator} alt="Piterator" className="size-5" />
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
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
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
          <Button asChild variant="ghost" size="icon" className="hidden">
            <Link href="/queue" scroll={false}>
              <ListChecks className="size-5" aria-hidden />
              <span className="sr-only">查看保存队列</span>
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="hidden">
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

  crumbs.push({ label: toTitleCase(first) });
  if (second) {
    crumbs.push({ label: decodeURIComponent(second) });
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
