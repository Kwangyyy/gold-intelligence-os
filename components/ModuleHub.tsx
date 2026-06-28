"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { canAccess, useTier } from "@/lib/tier";

interface HubItem {
  href: string;
  icon: string;
  navKey: string;
  descKey: string;
}

const ITEMS: HubItem[] = [
  { href: "/chart", icon: "📈", navKey: "navChart", descKey: "hub_chart_view" },
  { href: "/technical", icon: "📊", navKey: "navMultiTimeframe", descKey: "hub_technical" },
  { href: "/indicators", icon: "🔬", navKey: "navTechnical", descKey: "hub_indicators" },
  { href: "/smc", icon: "🧠", navKey: "navSmc", descKey: "hub_smc" },
  { href: "/levels", icon: "📐", navKey: "navLevels", descKey: "hub_levels" },
  { href: "/correlation", icon: "🔗", navKey: "navCorrelation", descKey: "hub_correlation" },
  { href: "/plan", icon: "🎯", navKey: "navPlan", descKey: "hub_plan" },
  { href: "/risk", icon: "🛡️", navKey: "navRisk", descKey: "hub_risk" },
  { href: "/whatif", icon: "🔮", navKey: "navWhatif", descKey: "hub_whatif" },
  { href: "/portfolio", icon: "💼", navKey: "navPortfolio", descKey: "hub_portfolio" },
  { href: "/alerts", icon: "🔔", navKey: "navAlerts", descKey: "hub_alerts" },
  { href: "/chat", icon: "🤖", navKey: "navChat", descKey: "hub_chat" },
  { href: "/content", icon: "📝", navKey: "navContent", descKey: "hub_content" },
  { href: "/calendar", icon: "📅", navKey: "navCalendar", descKey: "hub_calendar" },
  { href: "/journal", icon: "📒", navKey: "navJournal", descKey: "hub_journal" },
  { href: "/ea-builder", icon: "⚙️", navKey: "navEaBuilder", descKey: "hub_ea_builder" },
  { href: "/backtest",   icon: "🧪", navKey: "navBacktest",  descKey: "hub_backtest" },
  { href: "/brief",      icon: "📰", navKey: "navBrief",     descKey: "hub_brief"   },
  { href: "/scanner",    icon: "📡", navKey: "navScanner",     descKey: "hub_scanner"     },
  { href: "/seasonality", icon: "📅", navKey: "navSeasonality", descKey: "hub_seasonality" },
  { href: "/paper",       icon: "🎮", navKey: "navPaper",       descKey: "hub_paper"       },
  { href: "/news",        icon: "📰", navKey: "navNews",        descKey: "hub_news"        },
];

export function ModuleHub() {
  const { t } = useI18n();
  const { tier } = useTier();
  return (
    <section>
      <div className="stat-label mb-3">{t("hubTitle")}</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {ITEMS.map((it) => {
          const locked = !canAccess(tier, it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className="panel group flex flex-col gap-1 p-4 transition-colors hover:border-neon/40 hover:bg-base-panel"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{it.icon}</span>
                <span className="text-sm font-semibold text-silver group-hover:text-neon">
                  {t(it.navKey as never)}
                </span>
                {locked && <span className="ml-auto text-xs opacity-70">🔒</span>}
              </div>
              <span className="text-xs leading-snug text-silver/50">{t(it.descKey as never)}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
