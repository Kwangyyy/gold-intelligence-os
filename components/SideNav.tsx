"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { canAccess, useTier } from "@/lib/tier";
import { LanguageToggle } from "./LanguageToggle";
import { ModeToggle } from "./ModeToggle";
import { TierToggle } from "./TierToggle";
import { AuthButton } from "./AuthButton";

interface NavItem {
  href: string;
  icon: string;
  key: string;
}
interface NavGroup {
  key: string;   // i18n key for the group label
  icon: string;  // group header icon
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    key: "navGrpOverview", icon: "🏠",
    items: [
      { href: "/",              icon: "🏠", key: "navOverview"      },
      { href: "/markets",       icon: "🌐", key: "navMarkets"       },
      { href: "/market-summary",icon: "🧭", key: "navMarketSummary" },
      { href: "/chart",         icon: "📈", key: "navChart"         },
      { href: "/leaderboard",   icon: "🏆", key: "navLeaderboard"   },
    ],
  },
  {
    key: "navGrpTechnical", icon: "📊",
    items: [
      { href: "/technical",         icon: "📊", key: "navMultiTimeframe"   },
      { href: "/indicators",        icon: "🔬", key: "navTechnical"        },
      { href: "/levels",            icon: "📐", key: "navLevels"           },
      { href: "/patterns",          icon: "🕯", key: "navPatterns"         },
      { href: "/fibonacci",         icon: "🌀", key: "navFibonacci"        },
      { href: "/pivots",            icon: "🎯", key: "navPivots"           },
      { href: "/momentum",          icon: "📡", key: "navMomentum"         },
      { href: "/momentum-composite",icon: "📡", key: "navMomentumComposite"},
      { href: "/multi-momentum",    icon: "📡", key: "navMultiMomentum"    },
      { href: "/trend-strength",    icon: "📈", key: "navTrendStrength"    },
      { href: "/roc",               icon: "📉", key: "navRoc"              },
      { href: "/elliott-wave",      icon: "〰️", key: "navElliottWave"      },
      { href: "/price-heatmap",     icon: "🌡️", key: "navPriceHeatmap"     },
      { href: "/heatmap",           icon: "🌡️", key: "navHeatmap"          },
      { href: "/scalp-levels",      icon: "⚡", key: "navScalpLevels"      },
      { href: "/gold-structure",    icon: "🏗️", key: "navGoldStructure"    },
      { href: "/hurst-analysis",    icon: "〰️", key: "navHurstAnalysis"    },
      { href: "/volume-profile",    icon: "📊", key: "navVolumeProfile"    },
      { href: "/sessions",          icon: "🕐", key: "navSessions"         },
      { href: "/volatility",        icon: "📊", key: "navVolatility"       },
      { href: "/volatility-term",   icon: "📊", key: "navVolatilityTerm"   },
      { href: "/gold-volatility",   icon: "🌊", key: "navGoldVolatility"   },
      { href: "/vix-regime",        icon: "😨", key: "navVixRegime"        },
    ],
  },
  {
    key: "navGrpScanners", icon: "🔍",
    items: [
      { href: "/scanner",          icon: "📡", key: "navScanner"          },
      { href: "/scanner/multi",    icon: "🌐", key: "navMultiScanner"     },
      { href: "/breakout-scanner", icon: "🔍", key: "navBreakoutScanner"  },
      { href: "/divergence-scan",  icon: "🔍", key: "navDivergenceScan"   },
    ],
  },
  {
    key: "navGrpSmartMoney", icon: "🧠",
    items: [
      { href: "/smc",               icon: "🧠", key: "navSmc"              },
      { href: "/smart-money",       icon: "🧠", key: "navSmartMoney"       },
      { href: "/cme-oi",            icon: "🏛", key: "navCmeOi"            },
      { href: "/cot",               icon: "📋", key: "navCot"              },
      { href: "/cot-live",          icon: "📋", key: "navCotLive"          },
      { href: "/cot-extremes",      icon: "🎯", key: "navCotExtremes"      },
      { href: "/options-flow",      icon: "📊", key: "navOptionsFlow"      },
      { href: "/options-expiry",    icon: "📆", key: "navOptionsExpiry"    },
      { href: "/options-gamma",     icon: "⚡", key: "navOptionsGamma"     },
      { href: "/funding-rates",     icon: "📡", key: "navFundingRates"     },
      { href: "/etf-flows",         icon: "📈", key: "navEtfFlows"         },
      { href: "/etf-positioning",   icon: "💹", key: "navEtfPositioning"   },
      { href: "/flow-tracker",      icon: "🌊", key: "navFlowTracker"      },
      { href: "/trade-flow",        icon: "🌊", key: "navTradeFlow"        },
      { href: "/liquidity-map",     icon: "💧", key: "navLiquidityMap"     },
      { href: "/position-dashboard",icon: "📍", key: "navPositionDashboard"},
      { href: "/position-heat",     icon: "🌡️", key: "navPositionHeat"     },
      { href: "/futures-curve",     icon: "📐", key: "navFuturesCurve"     },
      { href: "/gold-leverage",     icon: "⚙️", key: "navGoldLeverage"     },
    ],
  },
  {
    key: "navGrpMacro", icon: "🌐",
    items: [
      { href: "/market-regime",   icon: "🎯", key: "navMarketRegime"    },
      { href: "/macro-regime",    icon: "🧭", key: "navMacroRegime"     },
      { href: "/macro-score",     icon: "🏛️", key: "navMacroScore"      },
      { href: "/macro-heat",      icon: "🌡️", key: "navMacroHeat"       },
      { href: "/macro-dashboard", icon: "🌐", key: "navMacroDashboard"  },
      { href: "/macro-scenario",  icon: "🎭", key: "navMacroScenario"   },
      { href: "/macro-drivers",   icon: "🎭", key: "navMacroDrivers"    },
      { href: "/yield-curve",     icon: "📉", key: "navYieldCurve"      },
      { href: "/yield-spread",    icon: "📈", key: "navYieldSpread"     },
      { href: "/global-yields",   icon: "🌐", key: "navGlobalYields"    },
      { href: "/gold-bonds",      icon: "🏦", key: "navGoldBonds"       },
      { href: "/rate-watch",      icon: "🏦", key: "navRateWatch"       },
      { href: "/fed-dot-plot",    icon: "🎯", key: "navFedDotPlot"      },
      { href: "/inflation-tracker",icon: "📊", key: "navInflationTracker"},
      { href: "/gold-breakeven",  icon: "🔥", key: "navGoldBreakeven"   },
      { href: "/money-supply",    icon: "💵", key: "navMoneySupply"     },
      { href: "/dxy-breakdown",   icon: "💱", key: "navDxyBreakdown"    },
      { href: "/dxy-correlation", icon: "💱", key: "navDxyCorrelation"  },
      { href: "/carry-trade",     icon: "💹", key: "navCarryTrade"      },
      { href: "/currency-stress", icon: "💱", key: "navCurrencyStress"  },
      { href: "/dollar-milkshake",icon: "🍵", key: "navDollarMilkshake" },
      { href: "/risk-parity",     icon: "⚖️", key: "navRiskParity"      },
      { href: "/risk-signals",    icon: "🎯", key: "navRiskSignals"     },
      { href: "/geo-risk",        icon: "🌍", key: "navGeoRisk"         },
    ],
  },
  {
    key: "navGrpFundamentals", icon: "⚖️",
    items: [
      { href: "/supply-demand",     icon: "⚖️", key: "navSupplyDemand"    },
      { href: "/gold-demand",       icon: "📊", key: "navGoldDemand"      },
      { href: "/gold-supply",       icon: "⛏", key: "navGoldSupply"      },
      { href: "/supply-shock",      icon: "⚠️", key: "navSupplyShock"     },
      { href: "/mining-stocks",     icon: "⛏", key: "navMiningStocks"    },
      { href: "/mining-cost",       icon: "⛏️", key: "navMiningCost"      },
      { href: "/producer-cost",     icon: "⛏️", key: "navProducerCost"    },
      { href: "/cb-tracker",        icon: "🏦", key: "navCbTracker"       },
      { href: "/comex-vault",       icon: "🏛️", key: "navComexVault"      },
      { href: "/gold-ownership",    icon: "🌐", key: "navGoldOwnership"   },
      { href: "/fair-value",        icon: "📐", key: "navFairValue"       },
      { href: "/gold-currencies",   icon: "💱", key: "navGoldCurrencies"  },
      { href: "/global-gold-price", icon: "🌍", key: "navGlobalGoldPrice" },
      { href: "/asia-premium",      icon: "🇨🇳", key: "navAsiaPremium"     },
      { href: "/miner-ratio",       icon: "⛏️", key: "navMinerRatio"      },
      { href: "/silver-ratio",      icon: "⚖️", key: "navSilverRatio"     },
      { href: "/gold-oil-ratio",    icon: "⚡", key: "navGoldOilRatio"    },
    ],
  },
  {
    key: "navGrpCorrelation", icon: "🔗",
    items: [
      { href: "/correlation",         icon: "🔗", key: "navCorrelation"        },
      { href: "/intermarket",         icon: "🌐", key: "navIntermarket"        },
      { href: "/intermarket-heatmap", icon: "🌍", key: "navIntermarketHeatmap" },
      { href: "/commodity-matrix",    icon: "🌐", key: "navCommodityMatrix"    },
      { href: "/crypto-gold",         icon: "₿",  key: "navCryptoGold"         },
      { href: "/gold-sp500",          icon: "⚡", key: "navGoldSP500"          },
      { href: "/copper-gold",         icon: "🔴", key: "navCopperGold"         },
      { href: "/gold-beta",           icon: "⚡", key: "navGoldBeta"           },
      { href: "/relative-strength",   icon: "📊", key: "navRelativeStrength"   },
      { href: "/market-breadth",      icon: "🌐", key: "navMarketBreadth"      },
      { href: "/market-internals",    icon: "🧩", key: "navMarketInternals"    },
      { href: "/fear-greed",          icon: "😱", key: "navFearGreed"          },
      { href: "/fear-index",          icon: "😱", key: "navFearIndex"          },
      { href: "/sentiment-dashboard", icon: "🧭", key: "navSentimentDashboard" },
    ],
  },
  {
    key: "navGrpCycle", icon: "🔄",
    items: [
      { href: "/gold-cycle",         icon: "🔄", key: "navGoldCycle"         },
      { href: "/gold-cycle-clock",   icon: "🕐", key: "navGoldCycleClock"    },
      { href: "/gold-cycle-analysis",icon: "🔄", key: "navGoldCycleAnalysis" },
      { href: "/seasonality",        icon: "📅", key: "navSeasonality"       },
      { href: "/seasonality2",       icon: "📅", key: "navSeasonality2"      },
      { href: "/seasonality-detail", icon: "📅", key: "navSeasonalityDetail" },
    ],
  },
  {
    key: "navGrpTools", icon: "🎯",
    items: [
      { href: "/plan",          icon: "🎯", key: "navPlan"          },
      { href: "/trade-setup",   icon: "🎯", key: "navTradeSetup"    },
      { href: "/trade-ideas",   icon: "💡", key: "navTradeIdeas"    },
      { href: "/trade-grade",   icon: "📋", key: "navTradeGrade"    },
      { href: "/whatif",        icon: "🔮", key: "navWhatif"        },
      { href: "/risk",          icon: "🛡️", key: "navRisk"          },
      { href: "/position-calc", icon: "📐", key: "navPositionCalc"  },
      { href: "/calculator",    icon: "📐", key: "navCalculator"    },
      { href: "/forecast",      icon: "🔮", key: "navForecast"      },
      { href: "/range-forecast",icon: "🎯", key: "navRangeForecast" },
      { href: "/paper",         icon: "🎮", key: "navPaper"         },
    ],
  },
  {
    key: "navGrpPortfolio", icon: "💼",
    items: [
      { href: "/portfolio",       icon: "💼", key: "navPortfolio"       },
      { href: "/ea-portfolio",    icon: "🧩", key: "navEaPortfolio"     },
      { href: "/performance",     icon: "📊", key: "navPerformance"     },
      { href: "/journal",         icon: "📒", key: "navJournal"         },
      { href: "/drawdown-tracker",icon: "📉", key: "navDrawdownTracker" },
      { href: "/ea-builder",      icon: "⚙️", key: "navEaBuilder"       },
      { href: "/ai-ea",           icon: "🤖", key: "navAiEa"            },
      { href: "/ea-monitor",      icon: "🔍", key: "navEaMonitor"       },
      { href: "/backtest",        icon: "🧪", key: "navBacktest"        },
      { href: "/robustness",      icon: "🛡️", key: "navRobustness"      },
      { href: "/sr-indicator",    icon: "📐", key: "navSrIndicator"     },
      { href: "/mt5",             icon: "🔌", key: "navMt5"             },
    ],
  },
  {
    key: "navGrpAiNews", icon: "🤖",
    items: [
      { href: "/council",          icon: "🏛", key: "navCouncil"         },
      { href: "/chat",             icon: "🤖", key: "navChat"            },
      { href: "/ai-model",         icon: "🧠", key: "navAiModel"         },
      { href: "/ai-model/history", icon: "📜", key: "navAiModelHistory"  },
      { href: "/content",          icon: "📝", key: "navContent"         },
      { href: "/news",             icon: "📰", key: "navNews"            },
      { href: "/news-sentiment",   icon: "📰", key: "navNewsSentiment"   },
      { href: "/news-impact",      icon: "📰", key: "navNewsImpact"      },
      { href: "/gold-news-catalyst",icon: "⚡", key: "navGoldNewsCatalyst"},
      { href: "/calendar",         icon: "📅", key: "navCalendar"        },
      { href: "/gold-calendar",    icon: "📅", key: "navGoldCalendar"    },
      { href: "/econ-calendar",    icon: "🗓️", key: "navEconCalendar"    },
      { href: "/econ-impact",      icon: "⚡", key: "navEconImpact"      },
      { href: "/event-study",      icon: "📚", key: "navEventStudy"      },
      { href: "/weekly-brief",     icon: "📰", key: "navWeeklyBrief"     },
      { href: "/brief",            icon: "📰", key: "navBrief"           },
    ],
  },
  {
    key: "navGrpSystem", icon: "🔔",
    items: [
      { href: "/alerts",       icon: "🔔", key: "navAlerts"      },
      { href: "/price-alerts", icon: "🎯", key: "navPriceAlerts" },
      { href: "/signal-log",   icon: "📡", key: "navSignalLog"   },
      { href: "/broadcast",    icon: "📢", key: "navBroadcast"   },
      { href: "/admin",        icon: "🔐", key: "navAdmin"       },
    ],
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SideNav({ open, onClose }: Props) {
  const { t } = useI18n();
  const pathname = usePathname();
  const { tier } = useTier();
  const { data: session } = useSession();
  const isAdmin = (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin ?? false;

  // Which category groups are expanded (accordion). Overview open by default.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["navGrpOverview"]));

  // Auto-expand the group that contains the active route (on navigation)
  useEffect(() => {
    const g = NAV_GROUPS.find(grp => grp.items.some(it => it.href === pathname));
    if (g) setExpanded(prev => (prev.has(g.key) ? prev : new Set(prev).add(g.key)));
  }, [pathname]);

  const toggleGroup = (key: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

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

      {/* ── Navigation (grouped accordion) ────────────────────── */}
      <nav className="relative flex-1 overflow-y-auto px-2.5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter(item => item.href !== "/admin" || isAdmin);
          if (items.length === 0) return null;

          const isOpen = expanded.has(group.key);
          const groupActive = items.some(it => it.href === pathname);

          return (
            <div key={group.key} className="mb-1">
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.key)}
                className="group/header relative flex w-full items-center gap-2 rounded-lg px-2.5 py-[7px] transition-all duration-150"
                style={
                  groupActive && !isOpen
                    ? { background: "linear-gradient(90deg, rgba(168,85,247,0.12), transparent)" }
                    : undefined
                }
              >
                <span className="relative z-10 w-4 text-center text-sm leading-none">
                  {group.icon}
                </span>
                <span
                  className="relative z-10 flex-1 truncate text-left text-[11px] font-bold uppercase tracking-wide"
                  style={{ color: groupActive ? "#f5c451" : "rgba(190,200,230,0.6)" }}
                >
                  {t(group.key as never)}
                </span>
                {/* count pill */}
                <span
                  className="relative z-10 rounded-full px-1.5 text-[8px] font-bold leading-[15px]"
                  style={{ background: "rgba(255,255,255,0.05)", color: "rgba(175,185,215,0.45)" }}
                >
                  {items.length}
                </span>
                {/* chevron */}
                <span
                  className="relative z-10 text-[9px] transition-transform duration-200"
                  style={{
                    color: "rgba(175,185,215,0.5)",
                    transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                  }}
                >
                  ▶
                </span>
              </button>

              {/* Group items */}
              {isOpen && (
                <div className="mt-0.5 space-y-[2px] pl-1">
                  {items.map((item) => {
                    const active = pathname === item.href;
                    const locked = !canAccess(tier, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className="group relative flex items-center gap-2.5 rounded-lg py-[6px] pl-3 pr-2.5 transition-all duration-150"
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
                        <span className="relative z-10 w-4 text-center text-xs leading-none">
                          {item.icon}
                        </span>
                        {/* label */}
                        <span
                          className="relative z-10 flex-1 truncate text-xs font-medium"
                          style={{
                            color: active ? "#f5c451" : "rgba(175,185,215,0.72)",
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
                </div>
              )}
            </div>
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
