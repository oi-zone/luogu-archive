"use client";

import * as React from "react";
import { ListTree, X } from "lucide-react";
import { useParams } from "next/navigation";

import { cn } from "@/lib/utils";

import { ArticleWaybackModal } from "./article-wayback-modal";

type TocItem = {
  id: string;
  text: string;
  level: number;
};

export default function Layout({
  titleRow,
  metaRow,
  metaCard,
  content,
  operationPanel,
  replies,
  recommendationsStacked,
  recommendationsInline,
}: {
  titleRow: React.ReactNode;
  metaRow: React.ReactNode;
  metaCard: React.ReactNode;
  content: React.ReactNode;
  operationPanel: React.ReactNode;
  replies: React.ReactNode;
  recommendationsStacked: React.ReactNode;
  recommendationsInline: React.ReactNode;
}) {
  const params = useParams<{ id: string; snapshot?: string }>();
  const snapshotParamRaw = params?.snapshot;
  const snapshotParam =
    typeof snapshotParamRaw === "string" ? snapshotParamRaw : null;

  const metaRowRef = React.useRef<HTMLDivElement | null>(null);
  const floatingMetaRef = React.useRef<HTMLDivElement | null>(null);
  const headerContainerRef = React.useRef<HTMLElement | null>(null);
  const contentRef = React.useRef<HTMLElement | null>(null);
  const gridRef = React.useRef<HTMLDivElement | null>(null);
  const tocDesktopCardRef = React.useRef<HTMLDivElement | null>(null);
  const [isMetaPinned, setIsMetaPinned] = React.useState(false);
  const [floatingMetaHeight, setFloatingMetaHeight] = React.useState(0);
  const previousSnapshotRef = React.useRef<string | null>(snapshotParam);
  const [tocItems, setTocItems] = React.useState<TocItem[]>([]);
  const [activeHeadingId, setActiveHeadingId] = React.useState<string | null>(
    null,
  );
  const [isMobileTocOpen, setIsMobileTocOpen] = React.useState(false);
  const [tocInitialOffset, setTocInitialOffset] = React.useState(0);
  const [tocTrackHeight, setTocTrackHeight] = React.useState(0);
  const TOC_STICKY_TOP = 96;
  const hasToc = tocItems.length > 0;

  const assignTocDesktopCardRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (node && node.offsetParent === null) {
        return;
      }
      tocDesktopCardRef.current = node;
    },
    [],
  );

  const collectHeadings = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const root = contentRef.current;
    if (!root) {
      setTocItems([]);
      return;
    }

    const nodes = Array.from(
      root.querySelectorAll<HTMLElement>("[data-md-heading='true']"),
    );
    if (nodes.length === 0) {
      setTocItems([]);
      return;
    }

    const headings: TocItem[] = nodes
      .map((node) => {
        const id = node.getAttribute("id");
        const text = node.getAttribute("data-heading-text")?.trim();
        const level = Number(node.getAttribute("data-heading-level") ?? "2");
        if (!id || !text) return null;
        return {
          id,
          text,
          level: Math.min(Math.max(level, 2), 6),
        };
      })
      .filter((heading): heading is TocItem => Boolean(heading));

    setTocItems((prev) => {
      const prevKey = prev.map((item) => item.id).join("|");
      const nextKey = headings.map((item) => item.id).join("|");
      if (prevKey === nextKey) return prev;
      return headings;
    });
  }, []);

  const scrollToHeading = React.useCallback((headingId: string) => {
    if (typeof window === "undefined") return;
    const target = document.getElementById(headingId);
    if (!target) return;

    const prefersDesktop = window.matchMedia("(min-width: 1024px)").matches;
    const offset = prefersDesktop ? 96 : 72;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
    setIsMobileTocOpen(false);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const TOP_OFFSET = 50;
    let animationFrame = 0;

    const runCheck = () => {
      animationFrame = 0;
      const target = metaRowRef.current;
      if (!target) return;

      const rect = target.getBoundingClientRect();
      const viewportHeight =
        window.innerHeight || document.documentElement.clientHeight;
      const isVisible = rect.top >= TOP_OFFSET && rect.top < viewportHeight;
      setIsMetaPinned(!isVisible);
    };

    const scheduleCheck = () => {
      if (animationFrame !== 0) return;
      animationFrame = window.requestAnimationFrame(runCheck);
    };

    window.addEventListener("scroll", scheduleCheck, { passive: true });
    window.addEventListener("resize", scheduleCheck);

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => scheduleCheck())
        : null;

    if (resizeObserver && metaRowRef.current) {
      resizeObserver.observe(metaRowRef.current);
    }

    runCheck();

    return () => {
      window.removeEventListener("scroll", scheduleCheck);
      window.removeEventListener("resize", scheduleCheck);
      if (animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame);
      }
      resizeObserver?.disconnect();
    };
  }, []);

  React.useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const node = floatingMetaRef.current;
    if (!node) return;

    const updateHeight = () => {
      const nextHeight = node.scrollHeight;
      setFloatingMetaHeight((prev) =>
        prev === nextHeight ? prev : nextHeight,
      );
    };

    updateHeight();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => updateHeight());
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const currentSnapshot = snapshotParam ?? null;
    if (previousSnapshotRef.current === currentSnapshot) {
      return;
    }

    const prefersDesktop = window.matchMedia("(min-width: 1024px)").matches;
    const target = prefersDesktop
      ? headerContainerRef.current
      : contentRef.current;
    const offset = prefersDesktop ? 96 : 72;

    if (target) {
      const rect = target.getBoundingClientRect();
      const top = Math.max(rect.top + window.scrollY - offset, 0);
      window.scrollTo({ top, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    previousSnapshotRef.current = currentSnapshot;
  }, [snapshotParam]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const frameId = window.requestAnimationFrame(() => collectHeadings());
    return () => window.cancelAnimationFrame(frameId);
  }, [collectHeadings, snapshotParam]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const root = contentRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => collectHeadings());
    observer.observe(root);
    return () => observer.disconnect();
  }, [collectHeadings]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (tocItems.length === 0) {
      setActiveHeadingId(null);
      return;
    }

    const resolveHeadingElements = () =>
      tocItems
        .map((item) => document.getElementById(item.id))
        .filter((node): node is HTMLElement => Boolean(node));

    let headingElements = resolveHeadingElements();
    if (headingElements.length === 0) {
      setActiveHeadingId(null);
      return;
    }

    let frameId = 0;
    const VIEWPORT_TOP_EPSILON = 4;

    const updateActiveHeading = () => {
      frameId = 0;
      if (!headingElements.length) {
        headingElements = resolveHeadingElements();
        if (!headingElements.length) {
          setActiveHeadingId(null);
          return;
        }
      }

      let candidateId: string | null = headingElements[0]?.id ?? null;
      for (const element of headingElements) {
        if (element.getBoundingClientRect().top <= VIEWPORT_TOP_EPSILON) {
          candidateId = element.id;
        } else {
          break;
        }
      }

      if (!candidateId) {
        candidateId = headingElements[headingElements.length - 1]?.id ?? null;
      }

      setActiveHeadingId((prev) => (prev === candidateId ? prev : candidateId));
    };

    const scheduleUpdate = () => {
      if (frameId !== 0) return;
      frameId = window.requestAnimationFrame(updateActiveHeading);
    };

    updateActiveHeading();

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && contentRef.current) {
      resizeObserver = new ResizeObserver(() => {
        headingElements = resolveHeadingElements();
        scheduleUpdate();
      });
      resizeObserver.observe(contentRef.current);
    }

    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
      resizeObserver?.disconnect();
    };
  }, [tocItems]);

  React.useEffect(() => {
    if (!tocItems.length && isMobileTocOpen) {
      setIsMobileTocOpen(false);
    }
  }, [tocItems.length, isMobileTocOpen]);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    if (!isMobileTocOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileTocOpen]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(min-width: 1024px)");
    const handler = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsMobileTocOpen(false);
      }
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  React.useLayoutEffect(() => {
    if (!hasToc) {
      setTocInitialOffset(0);
      setTocTrackHeight(0);
      return;
    }

    if (typeof window === "undefined") return;

    const updateOffset = () => {
      if (!gridRef.current || !contentRef.current) return;
      const gridRect = gridRef.current.getBoundingClientRect();
      const contentRect = contentRef.current.getBoundingClientRect();
      const nextOffset = Math.max(contentRect.top - gridRect.top, 0);
      setTocInitialOffset(nextOffset);
      const nextTrackHeight = Math.max(contentRect.bottom - gridRect.top, 0);
      setTocTrackHeight(nextTrackHeight);
    };

    updateOffset();

    window.addEventListener("resize", updateOffset);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && contentRef.current) {
      resizeObserver = new ResizeObserver(() => updateOffset());
      resizeObserver.observe(contentRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateOffset);
      resizeObserver?.disconnect();
    };
  }, [TOC_STICKY_TOP, hasToc, tocItems.length]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const updateClamp = () => {
      if (!contentRef.current || !tocDesktopCardRef.current) return;
    };

    updateClamp();

    window.addEventListener("scroll", updateClamp, { passive: true });
    window.addEventListener("resize", updateClamp);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && tocDesktopCardRef.current) {
      resizeObserver = new ResizeObserver(() => updateClamp());
      resizeObserver.observe(tocDesktopCardRef.current);
    }

    return () => {
      window.removeEventListener("scroll", updateClamp);
      window.removeEventListener("resize", updateClamp);
      resizeObserver?.disconnect();
    };
  }, [hasToc, tocItems.length]);

  const tocMarginTop = Math.max(tocInitialOffset, 0);

  const tocTrackStyle = React.useMemo<React.CSSProperties>(() => {
    if (!hasToc) return {};
    const style: React.CSSProperties = {};
    if (tocMarginTop > 0) {
      style.paddingTop = tocMarginTop;
    }
    if (tocTrackHeight > 0) {
      style.height = tocTrackHeight;
      style.minHeight = tocTrackHeight;
    }
    return style;
  }, [hasToc, tocMarginTop, tocTrackHeight]);

  const tocStickyStyle = React.useMemo<React.CSSProperties>(() => {
    const style: React.CSSProperties = {
      top: `${TOC_STICKY_TOP}px`,
    };
    return style;
  }, [TOC_STICKY_TOP]);

  return (
    <>
      <div className="flex flex-1 justify-center px-4 pt-8 pb-16 sm:px-6 lg:px-8">
        <div className="relative w-full">
          {hasToc ? (
            <div
              className={cn(
                "article-floating-toc pointer-events-none",
                "hidden lg:flex lg:items-center lg:justify-end 2xl:hidden",
              )}
            >
              <div className="article-floating-toc-hitbox">
                <button
                  type="button"
                  aria-label="查看文章目录"
                  className="article-floating-toc-button"
                >
                  <ListTree className="h-5 w-5" />
                </button>
                <div className="article-floating-toc-panel">
                  <div className="article-toc-card">
                    <div className="article-toc-card-header">内容目录</div>
                    <TocNavigation
                      items={tocItems}
                      activeId={activeHeadingId}
                      onNavigate={scrollToHeading}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div
            ref={gridRef}
            className={cn(
              "article-grid grid gap-8",
              "lg:grid-cols-[minmax(0,8fr)_minmax(0,3.2fr)]",
              "xl:grid-cols-[minmax(0,8fr)_minmax(0,2.7fr)]",
              "2xl:grid-cols-[minmax(0,3fr)_minmax(0,8fr)_minmax(0,3fr)]",
              hasToc &&
                "3xl:grid-cols-[minmax(0,2.5fr)_minmax(0,2.4fr)_minmax(0,9fr)_minmax(0,3fr)]",
            )}
          >
            <aside className="hidden 2xl:order-1 2xl:flex 2xl:flex-col 2xl:gap-4">
              {hasToc ? (
                <div className="hidden 2xl:block 3xl:hidden">
                  <div className="article-toc-track" style={tocTrackStyle}>
                    <div
                      ref={assignTocDesktopCardRef}
                      className="article-toc-card sticky"
                      style={tocStickyStyle}
                    >
                      <div className="article-toc-card-header">内容目录</div>
                      <TocNavigation
                        items={tocItems}
                        activeId={activeHeadingId}
                        onNavigate={scrollToHeading}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              <div className={cn(hasToc ? "hidden 3xl:block" : "block")}>
                {recommendationsStacked}
              </div>
            </aside>

            {hasToc ? (
              <aside
                className="article-toc-3xl hidden 3xl:order-2 3xl:block"
                aria-label="文章目录"
              >
                <div className="article-toc-track" style={tocTrackStyle}>
                  <div
                    ref={assignTocDesktopCardRef}
                    className="article-toc-card sticky"
                    style={tocStickyStyle}
                  >
                    <div className="article-toc-card-header">内容目录</div>
                    <TocNavigation
                      items={tocItems}
                      activeId={activeHeadingId}
                      onNavigate={scrollToHeading}
                    />
                  </div>
                </div>
              </aside>
            ) : null}

            <main className="order-1 flex flex-col gap-8 2xl:order-3">
              <section className="flex flex-col gap-6">
                <header className="space-y-4" ref={headerContainerRef}>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-3">{titleRow}</div>
                      {hasToc ? (
                        <button
                          type="button"
                          className="article-toc-mobile-trigger inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-foreground/40 hover:text-foreground lg:hidden"
                          onClick={() => setIsMobileTocOpen(true)}
                        >
                          <ListTree className="h-3.5 w-3.5" />
                          目录
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div ref={metaRowRef}>{metaRow}</div>
                </header>

                <div className="lg:hidden">{operationPanel}</div>

                <section
                  ref={contentRef}
                  className="space-y-6 text-base leading-relaxed text-muted-foreground sm:text-lg"
                >
                  {content}
                </section>
              </section>

              <div
                className={cn("block", hasToc ? "3xl:hidden" : "2xl:hidden")}
              >
                {recommendationsInline}
              </div>

              {replies}
            </main>

            <aside className="order-2 hidden lg:order-2 lg:block 2xl:order-4">
              <div className="sticky top-24 flex flex-col gap-4">
                <div
                  className="grid transition-[grid-template-rows,gap] duration-300 ease-out"
                  style={{
                    gridTemplateRows: `${isMetaPinned ? floatingMetaHeight : 0}px auto`,
                    gap: isMetaPinned ? "14px" : "0px",
                  }}
                >
                  <div
                    className={cn(
                      "relative h-full transition-opacity duration-300 ease-out",
                      isMetaPinned ? "opacity-100" : "opacity-0",
                    )}
                  >
                    <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-sm" />
                    <div className="h-full overflow-hidden rounded-2xl border border-border bg-background/95">
                      <div ref={floatingMetaRef} className="px-5 py-4">
                        {metaCard}
                      </div>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "transition-transform duration-300 ease-out will-change-transform",
                      isMetaPinned ? "translate-y-[2px]" : "translate-y-0",
                    )}
                  >
                    {operationPanel}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {hasToc ? (
        <div
          className={cn(
            "article-mobile-toc fixed inset-0 z-50 bg-background/70 px-4 py-6 backdrop-blur lg:hidden",
            isMobileTocOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0",
          )}
        >
          <div className="mx-auto w-full max-w-sm rounded-3xl border bg-background p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                内容目录
              </div>
              <button
                type="button"
                className="rounded-full border p-1 text-muted-foreground transition hover:text-foreground"
                onClick={() => setIsMobileTocOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto pr-1">
              <TocNavigation
                items={tocItems}
                activeId={activeHeadingId}
                onNavigate={scrollToHeading}
              />
            </div>
          </div>
        </div>
      ) : null}

      <ArticleWaybackModal />
    </>
  );
}

type TocNavigationProps = {
  items: TocItem[];
  activeId: string | null;
  onNavigate: (id: string) => void;
};

function TocNavigation({ items, activeId, onNavigate }: TocNavigationProps) {
  if (!items.length) return null;

  return (
    <ol className="article-toc-list space-y-0.5 text-sm">
      {items.map((item) => {
        const normalizedLevel = Math.min(Math.max(item.level, 2), 6);
        const isActive = item.id === activeId;
        return (
          <li key={item.id}>
            <button
              type="button"
              className={cn(
                "article-toc-entry",
                `article-toc-level-${normalizedLevel}`,
                isActive && "article-toc-entry-active",
              )}
              onClick={() => onNavigate(item.id)}
            >
              <span className="line-clamp-2 text-left">{item.text}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
