"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

const TF: { code: string; interval: string }[] = [
  { code: "M15", interval: "15" },
  { code: "M30", interval: "30" },
  { code: "H1",  interval: "60" },
  { code: "H4",  interval: "240" },
  { code: "D1",  interval: "D" },
  { code: "W1",  interval: "W" },
];

export function GoldChart({
  heightClass = "h-[78vh] min-h-[560px]",
  defaultInterval = "60",
  tvSymbol = "OANDA:XAUUSD",
}: {
  heightClass?: string;
  defaultInterval?: string;
  tvSymbol?: string;
}) {
  const { lang } = useI18n();
  const [interval, setInterval_] = useState(defaultInterval);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '<div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div>';

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval,
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: lang === "th" ? "th" : "en",
      backgroundColor: "rgba(5, 7, 13, 1)",
      gridColor: "rgba(30, 44, 68, 0.4)",
      allow_symbol_change: false,
      hide_side_toolbar: false,
      withdateranges: true,
      studies: ["MAExp@tv-basicstudies", "RSI@tv-basicstudies", "MACD@tv-basicstudies"],
      support_host: "https://www.tradingview.com",
    });
    container.appendChild(script);

    return () => { container.innerHTML = ""; };
  }, [interval, lang, tvSymbol]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1 rounded-xl border border-base-border bg-base-panel p-1">
        {TF.map((tf) => (
          <button key={tf.code} onClick={() => setInterval_(tf.interval)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
              interval === tf.interval ? "bg-gold/20 text-gold" : "text-silver/60 hover:text-silver"
            }`}>
            {tf.code}
          </button>
        ))}
      </div>
      <div className={`${heightClass} w-full overflow-hidden rounded-2xl border border-base-border shadow-goldglow`}>
        <div ref={containerRef} className="tradingview-widget-container h-full w-full" />
      </div>
    </div>
  );
}
