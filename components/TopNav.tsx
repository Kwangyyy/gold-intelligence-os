"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { canAccess, useTier } from "@/lib/tier";
import { LanguageToggle } from "./LanguageToggle";
import { ModeToggle } from "./ModeToggle";
import { TierToggle } from "./TierToggle";

export function TopNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const { tier } = useTier();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const links = [
    { href: "/", label: t("navOverview") },
    { href: "/chart", label: t("navChart") },
    { href: "/technical", label: t("navMultiTimeframe") },
    { href: "/indicators", label: t("navTechnical") },
    { href: "/smc", label: t("navSmc") },
    { href: "/levels", label: t("navLevels") },
    { href: "/correlation", label: t("navCorrelation") },
    { href: "/risk", label: t("navRisk") },
    { href: "/plan", label: t("navPlan") },
    { href: "/whatif", label: t("navWhatif") },
    { href: "/portfolio", label: t("navPortfolio") },
    { href: "/alerts", label: t("navAlerts") },
    { href: "/chat", label: t("navChat") },
    { href: "/content", label: t("navContent") },
    { href: "/calendar", label: t("navCalendar") },
    { href: "/journal", label: t("navJournal") },
    { href: "/ea-builder", label: t("navEaBuilder") },
    { href: "/backtest",   label: t("navBacktest") },
    { href: "/brief",      label: t("navBrief") },
  ];

  const updateArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    el?.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el?.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, []);

  // Scroll active tab into view when route changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>('[data-active="true"]');
    if (active) active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    setTimeout(updateArrows, 150);
  }, [pathname]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  };

  return (
    <nav className="sticky top-0 z-20 border-b border-base-border bg-base-black/85 backdrop-blur">
      {/* Row 1: brand + controls */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-gold/40 bg-gold/10 text-lg shadow-goldglow">
            🪙
          </div>
          <div className="hidden leading-tight sm:block">
            <div className="text-sm font-bold tracking-wide text-gradient-gold">{t("appTitle")}</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-silver/40">XAUUSD Intelligence</div>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <TierToggle />
          <ModeToggle />
          <LanguageToggle />
        </div>
      </div>

      {/* Row 2: scrollable tabs with arrow buttons */}
      <div className="relative border-t border-base-border/60">
        {/* Left arrow */}
        {canLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-0 z-10 flex h-full items-center bg-gradient-to-r from-base-black/90 to-transparent px-2 text-silver/50 hover:text-silver transition-colors"
            aria-label="scroll left"
          >
            ‹
          </button>
        )}

        <div
          ref={scrollRef}
          className="mx-auto flex max-w-7xl items-center gap-0.5 overflow-x-auto px-2 sm:px-4 lg:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {links.map((l) => {
            const active = pathname === l.href;
            const locked = !canAccess(tier, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                data-active={active}
                className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-medium transition-colors sm:text-sm ${
                  active
                    ? "border-neon text-neon"
                    : "border-transparent text-silver/55 hover:border-base-border hover:text-silver"
                }`}
              >
                {l.label}
                {locked && <span className="ml-1 text-[10px] opacity-60">🔒</span>}
              </Link>
            );
          })}
        </div>

        {/* Right arrow */}
        {canRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-0 z-10 flex h-full items-center bg-gradient-to-l from-base-black/90 to-transparent px-2 text-silver/50 hover:text-silver transition-colors"
            aria-label="scroll right"
          >
            ›
          </button>
        )}
      </div>
    </nav>
  );
}
