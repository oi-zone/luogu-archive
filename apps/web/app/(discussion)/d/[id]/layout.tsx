"use client";

import * as React from "react";
import { useParams } from "next/navigation";

import { cn } from "@/lib/utils";
import Container from "@/components/layout/container";

import { DiscussionWaybackModal } from "./wayback-modal";

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
  const [isMetaPinned, setIsMetaPinned] = React.useState(false);
  const [floatingMetaHeight, setFloatingMetaHeight] = React.useState(0);
  const previousSnapshotRef = React.useRef<string | null>(snapshotParam);

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

  return (
    <>
      <Container>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,8fr)_minmax(0,3.2fr)] xl:grid-cols-[minmax(0,8fr)_minmax(0,2.7fr)] 2xl:grid-cols-[minmax(0,3fr)_minmax(0,8fr)_minmax(0,3fr)]">
          <aside className="hidden 2xl:flex 2xl:flex-col 2xl:gap-4">
            {recommendationsStacked}
          </aside>

          <main className="order-1 flex flex-col gap-8 2xl:order-2">
            <section className="flex flex-col gap-6">
              <header className="space-y-4" ref={headerContainerRef}>
                {titleRow}

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

            {replies}

            <div className="2xl:hidden">{recommendationsInline}</div>
          </main>

          <aside className="order-2 hidden lg:order-2 lg:block 2xl:order-3">
            <div className="sticky top-24.25 flex flex-col gap-4">
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
                  <div className="pointer-events-none absolute inset-0" />
                  <div className="h-full overflow-hidden">
                    <div ref={floatingMetaRef} className="pb-2.5">
                      {metaCard}
                      <hr className="mt-7" />
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
      </Container>

      <DiscussionWaybackModal />
    </>
  );
}
