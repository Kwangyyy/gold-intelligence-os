"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { canAccess, useTier } from "@/lib/tier";
import { LanguageToggle } from "./LanguageToggle";
import { ModeToggle } from "./ModeToggle";
import { TierToggle } from "./TierToggle";
import { AuthButton } from "./AuthButton";

const NAV = [
  { href: "/",            icon: "🏠", key: "navOverview"       },
  { href: "/markets",     icon: "🌐", key: "navMarkets"        },
  { href: "/chart",       icon: "📈", key: "navChart"          },
  { href: "/technical",   icon: "📊", key: "navMultiTimeframe" },
  { href: "/indicators",  icon: "🔬", key: "navTechnical"      },
  { href: "/smc",         icon: "🧠", key: "navSmc"            },
  { href: "/levels",      icon: "📐", key: "navLevels"         },
  { href: "/correlation", icon: "🔗", key: "navCorrelation"    },
  { href: "/risk",        icon: "🛡️", key: "navRisk"           },
  { href: "/plan",        icon: "🎯", key: "navPlan"           },
  { href: "/whatif",      icon: "🔮", key: "navWhatif"         },
  { href: "/portfolio",   icon: "💼", key: "navPortfolio"      },
  { href: "/alerts",      icon: "🔔", key: "navAlerts"         },
  { href: "/chat",        icon: "🤖", key: "navChat"           },
  { href: "/content",     icon: "📝", key: "navContent"        },
  { href: "/calendar",    icon: "📅", key: "navCalendar"       },
  { href: "/journal",     icon: "📒", key: "navJournal"        },
  { href: "/ea-builder",  icon: "⚙️", key: "navEaBuilder"      },
  { href: "/ai-ea",         icon: "🤖", key: "navAiEa"         },
  { href: "/sr-indicator",  icon: "📐", key: "navSrIndicator"  },
  { href: "/cme-oi",        icon: "🏛", key: "navCmeOi"        },
  { href: "/ea-monitor",    icon: "🔍", key: "navEaMonitor"    },
  { href: "/ai-model",         icon: "🧠", key: "navAiModel"        },
  { href: "/ai-model/history", icon: "📜", key: "navAiModelHistory" },
  { href: "/trade-ideas",      icon: "💡", key: "navTradeIdeas"     },
  { href: "/market-regime",   icon: "🎯", key: "navMarketRegime"   },
  { href: "/forecast",        icon: "🔮", key: "navForecast"       },
  { href: "/patterns",        icon: "🕯", key: "navPatterns"       },
  { href: "/sessions",        icon: "🕐", key: "navSessions"       },
  { href: "/backtest",    icon: "🧪", key: "navBacktest"       },
  { href: "/brief",       icon: "📰", key: "navBrief"          },
  { href: "/scanner",       icon: "📡", key: "navScanner"        },
  { href: "/scanner/multi", icon: "🌐", key: "navMultiScanner"    },
  { href: "/seasonality", icon: "📅", key: "navSeasonality"    },
  { href: "/paper",       icon: "🎮", key: "navPaper"          },
  { href: "/calculator",  icon: "📐", key: "navCalculator"     },
  { href: "/price-alerts", icon: "🎯", key: "navPriceAlerts"  },
  { href: "/signal-log",  icon: "📡", key: "navSignalLog"     },
  { href: "/heatmap",     icon: "🌡️", key: "navHeatmap"       },
  { href: "/mt5",         icon: "🔌", key: "navMt5"           },
  { href: "/econ-calendar", icon: "🗓️", key: "navEconCalendar"  },
  { href: "/performance",   icon: "📊", key: "navPerformance"   },
  { href: "/intermarket",   icon: "🌐", key: "navIntermarket"   },
  { href: "/cot",           icon: "📋", key: "navCot"           },
  { href: "/broadcast",     icon: "📢", key: "navBroadcast"     },
  { href: "/news",        icon: "📰", key: "navNews"           },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SideNav({ open, onClose }: Props) {
  const { t } = useI18n();
  const pathname = usePathname();
  const { tier } = useTier();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 flex w-[232px] flex-col transition-transform duration-300 ease-in-out
        ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      style={{
        background: "linear-gradient(170deg, #0d0818 0%, #090d1e 52%, #06091a 100%)",
        boxShadow:
          "12px 0 48px -8px rgba(0,0,0,0.8), 4px 0 16px rgba(168,85,247,0.1)",
      }}
    >
      {/* Gradient right border */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-full w-px"
        style={{
          background:
            "linear-gradient(180deg, rgba(245,196,81,0.8) 0%, rgba(168,85,247,0.7) 30%, rgba(168,85,247,0.4) 65%, rgba(245,196,81,0.5) 100%)",
        }}
      />

      {/* Ambient glow from logo area */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-48 w-full"
        style={{
          background:
            "radial-gradient(ellipse 180px 100px at 50% 0%, rgba(168,85,247,0.12) 0%, transparent 70%)",
        }}
      />

      {/* ── Brand ─────────────────────────────────────────────── */}
      <div className="relative px-4 pb-3 pt-5">
        <div className="flex items-center gap-2.5">
          {/* Logo jewel */}
          <div
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
            style={{
              background:
                "linear-gradient(135deg, rgba(245,196,81,0.2) 0%, rgba(168,85,247,0.2) 100%)",
              border: "1px solid rgba(245,196,81,0.45)",
              boxShadow:
                "0 0 20px rgba(245,196,81,0.15), 0 0 8px rgba(168,85,247,0.1)",
            }}
          >
            🪙
            {/* inner glow rim */}
            <span
              aria-hidden
              className="absolute inset-0 rounded-xl"
              style={{
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
            />
          </div>
          <div className="leading-snug">
            <div
              className="text-[11px] font-bold tracking-wide"
              style={{
                background:
                  "linear-gradient(95deg, #fbe6a2 0%, #f5c451 48%, #c084fc 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Gold Intelligence
            </div>
            <div
              className="text-[9px] uppercase tracking-[0.2em]"
              style={{ color: "rgba(192,132,252,0.7)" }}
            >
              OS · XAUUSD
            </div>
          </div>
        </div>

        {/* Divider */}
        <div
          className="mt-4 h-px"
          style={{
            background:
              "linear-gradient(90deg, rgba(245,196,81,0.5), rgba(168,85,247,0.5) 55%, transparent)",
          }}
        />
      </div>

      {/* ── Navigation ────────────────────────────────────────── */}
      <nav className="relative flex-1 overflow-y-auto px-2.5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV.map((item) => {
          const active = pathname === item.href;
          const locked = !canAccess(tier, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="group relative mb-[3px] flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] transition-all duration-150"
              style={
                active
                  ? {
                      background:
                        "linear-gradient(90deg, rgba(168,85,247,0.24) 0%, rgba(245,196,81,0.07) 100%)",
                      boxShadow: "inset 3px 0 0 #f5c451",
                    }
                  : undefined
              }
            >
              {/* hover bg */}
              {!active && (
                <span
                  className="absolute inset-0 rounded-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  style={{
                    background:
                      "linear-gradient(90deg, rgba(168,85,247,0.13), rgba(245,196,81,0.04))",
                  }}
                />
              )}
              {/* icon */}
              <span className="relative z-10 w-4 text-center text-sm leading-none">
                {item.icon}
              </span>
              {/* label */}
              <span
                className="relative z-10 flex-1 truncate text-xs font-medium"
                style={{
                  color: active
                    ? "#f5c451"
                    : "rgba(175,185,215,0.72)",
                }}
              >
                {t(item.key as never)}
              </span>
              {/* lock */}
              {locked && (
                <span className="relative z-10 text-[10px] opacity-40">
                  🔒
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Controls ──────────────────────────────────────────── */}
      <div className="relative px-3 pb-4 pt-2">
        <div
          className="mb-3 h-px"
          style={{
            background:
              "linear-gradient(90deg, rgba(168,85,247,0.4), rgba(245,196,81,0.4) 55%, transparent)",
          }}
        />
        <div className="flex flex-col gap-2">
          {/* Tier — full width */}
          <div className="flex">
            <TierToggle />
          </div>
          {/* Mode + Lang side by side */}
          <div className="flex items-center gap-1.5">
            <ModeToggle />
            <LanguageToggle />
          </div>
          {/* Auth */}
          <AuthButton />
        </div>
      </div>
    </aside>
  );
}
