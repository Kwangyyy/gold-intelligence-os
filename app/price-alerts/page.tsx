"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Disclaimer } from "@/components/Disclaimer";
import type { PriceAlert, AlertCondition } from "@/lib/priceAlertStore";

const TG_KEY = "gios.telegram";
const POLL_MS = 10_000;

function loadChatId(): string {
  try { const r = localStorage.getItem(TG_KEY); if (r) return JSON.parse(r).chatId ?? ""; } catch {}
  return "";
}

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function ConditionToggle({ value, onChange }: { value: AlertCondition; onChange: (v: AlertCondition) => void }) {
  return (
    <div className="flex overflow-hidden rounded-xl border border-base-border/40">
      {(["above", "below"] as AlertCondition[]).map(c => (
        <button key={c} onClick={() => onChange(c)}
          className="flex-1 py-2 text-xs font-bold transition-colors"
          style={value === c
            ? { background: c === "above" ? "rgba(52,211,153,0.18)" : "rgba(248,113,113,0.18)", color: c === "above" ? "#34d399" : "#f87171" }
            : { background: "transparent", color: "#475569" }}>
          {c === "above" ? "⬆️ Above" : "⬇️ Below"}
        </button>
      ))}
    </div>
  );
}

export default function PriceAlertsPage() {
  const [alerts, setAlerts]       = useState<PriceAlert[]>([]);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [priceTs, setPriceTs]     = useState(0);
  const [chatId, setChatId]       = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [condition, setCondition] = useState<AlertCondition>("above");
  const [note, setNote]           = useState("");
  const [adding, setAdding]       = useState(false);
  const [addErr, setAddErr]       = useState("");
  const [lastFired, setLastFired] = useState<string[]>([]);

  const priceRef = useRef<number | null>(null);
  priceRef.current = livePrice;

  // Load chatId from Telegram settings in localStorage
  useEffect(() => { setChatId(loadChatId()); }, []);

  // Fetch alerts list
  async function fetchAlerts() {
    try {
      const r = await fetch("/api/price-alerts");
      setAlerts(await r.json());
    } catch {}
  }

  // Check alerts against current price
  async function checkAlerts(price: number) {
    const active = alerts.filter(a => !a.triggered);
    if (active.length === 0) return;
    try {
      const r = await fetch("/api/price-alerts/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price }),
      });
      const data = await r.json();
      if (data.fired > 0) {
        setLastFired(data.results.filter((x: { ok: boolean }) => x.ok).map((x: { id: string }) => x.id));
        await fetchAlerts(); // refresh list
      }
    } catch {}
  }

  // Poll market price + check alerts
  useEffect(() => {
    fetchAlerts();
    async function poll() {
      try {
        const r = await fetch("/api/market/xauusd");
        const d = await r.json();
        if (d?.price > 0) {
          setLivePrice(d.price);
          setPriceTs(Date.now());
          await checkAlerts(d.price);
        }
      } catch {}
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addAlert() {
    const price = parseFloat(targetPrice);
    if (!price || price <= 0) { setAddErr("ใส่ราคาให้ถูกต้อง"); return; }
    if (!chatId.trim()) { setAddErr("ใส่ Telegram Chat ID ก่อน"); return; }
    setAdding(true); setAddErr("");
    try {
      const r = await fetch("/api/price-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPrice: price, condition, chatId: chatId.trim(), note }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
      setTargetPrice(""); setNote("");
      await fetchAlerts();
    } catch (e) {
      setAddErr(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally { setAdding(false); }
  }

  async function removeAlert(id: string) {
    await fetch("/api/price-alerts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await fetchAlerts();
  }

  const active    = alerts.filter(a => !a.triggered);
  const triggered = alerts.filter(a => a.triggered).slice(-5).reverse();
  const secsAgo   = priceTs > 0 ? Math.floor((Date.now() - priceTs) / 1000) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Price Alerts 🔔" subtitle="ตั้ง target price → ส่ง Telegram เมื่อ Gold ถึงราคา (Upstash Redis)" />

      {/* Live price badge */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-gold/25 bg-gold/5 px-4 py-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-xs text-silver/50">XAUUSD</span>
          <span className="font-mono text-sm font-black text-gold">
            {livePrice ? `$${fmt(livePrice)}` : "กำลังโหลด…"}
          </span>
          {secsAgo !== null && <span className="text-[10px] text-silver/30">{secsAgo}s ago</span>}
        </div>
        <span className="text-[11px] text-silver/30">ตรวจสอบทุก {POLL_MS / 1000}s</span>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* ── Add Alert Form ──────────────────────────────────────── */}
        <div className="panel flex flex-col gap-4 p-5">
          <div className="text-xs font-bold uppercase tracking-widest text-silver/40">ตั้ง Alert ใหม่</div>

          {/* Telegram Chat ID */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-silver/55">Telegram Chat ID</label>
            <input value={chatId} onChange={e => setChatId(e.target.value)} placeholder="เช่น 123456789"
              className="rounded-xl border border-base-border/40 bg-base-panel/60 px-3 py-2 text-sm font-mono text-silver outline-none focus:border-gold/40" />
            <span className="text-[10px] text-silver/30">
              {chatId ? `✓ ใช้ @userinfobot เพื่อดู ID` : "ใส่ ID จาก @userinfobot"}
            </span>
          </div>

          {/* Target Price */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-silver/55">Target Price (USD)</label>
            <div className="flex gap-2">
              <input value={targetPrice} onChange={e => setTargetPrice(e.target.value)}
                type="number" step="0.01" placeholder={livePrice ? livePrice.toFixed(2) : "0.00"}
                className="flex-1 rounded-xl border border-base-border/40 bg-base-panel/60 px-3 py-2 text-sm font-mono text-silver outline-none focus:border-gold/40" />
              {livePrice && (
                <button onClick={() => setTargetPrice(livePrice.toFixed(2))}
                  className="rounded-xl border border-base-border/30 px-2 text-[10px] text-silver/40 hover:text-silver/70 transition-colors">
                  Live
                </button>
              )}
            </div>
          </div>

          {/* Condition toggle */}
          <ConditionToggle value={condition} onChange={setCondition} />

          {/* Note */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-silver/55">Note (ไม่บังคับ)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="เช่น แนวรับ H4"
              className="rounded-xl border border-base-border/40 bg-base-panel/60 px-3 py-2 text-sm text-silver outline-none focus:border-gold/40" />
          </div>

          {addErr && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{addErr}</div>}

          <button onClick={addAlert} disabled={adding}
            className="rounded-xl py-2.5 text-sm font-bold transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,rgba(245,196,81,0.2),rgba(168,85,247,0.12))", border: "1px solid rgba(245,196,81,0.4)", color: "#f5c451" }}>
            {adding ? "กำลังบันทึก…" : "➕ ตั้ง Alert"}
          </button>

          {/* Telegram notice */}
          <div className="rounded-xl border border-base-border/20 bg-white/[0.015] px-3 py-2 text-[10px] text-silver/35 leading-relaxed">
            ต้องตั้งค่า <code>TELEGRAM_BOT_TOKEN</code> ใน Vercel env vars ก่อน · Chat ID จาก @userinfobot
          </div>
        </div>

        {/* ── Active Alerts ───────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-silver/40">Active ({active.length})</span>
              <span className="text-[10px] text-silver/25">เก็บใน Redis</span>
            </div>
            {active.length === 0 ? (
              <div className="py-6 text-center text-sm text-silver/25">ยังไม่มี alert</div>
            ) : (
              <div className="flex flex-col gap-2">
                {active.map(a => (
                  <div key={a.id} className="flex items-center gap-2 rounded-xl border border-base-border/25 bg-white/[0.02] px-3 py-2.5">
                    <span className="text-sm">{a.condition === "above" ? "⬆️" : "⬇️"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm font-bold text-silver/80">${fmt(a.targetPrice)}</div>
                      {a.note && <div className="text-[10px] text-silver/35 truncate">{a.note}</div>}
                    </div>
                    <button onClick={() => removeAlert(a.id)}
                      className="text-[11px] text-silver/25 hover:text-red-400 transition-colors px-1">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Triggered history */}
          {triggered.length > 0 && (
            <div className="panel p-4">
              <div className="mb-3 text-xs font-bold uppercase tracking-widest text-silver/40">Triggered</div>
              <div className="flex flex-col gap-2">
                {triggered.map(a => (
                  <div key={a.id} className="flex items-center gap-2 rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-3 py-2">
                    <span className="text-xs text-emerald-400">✓</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs text-silver/55">${fmt(a.targetPrice)} {a.condition}</div>
                      {a.triggeredAt && (
                        <div className="text-[10px] text-silver/30">
                          {new Date(a.triggeredAt).toLocaleString("th-TH", { timeStyle: "short", dateStyle: "short" })}
                        </div>
                      )}
                    </div>
                    {lastFired.includes(a.id) && <span className="text-[10px] text-emerald-400">📨 ส่งแล้ว</span>}
                    <button onClick={() => removeAlert(a.id)}
                      className="text-[11px] text-silver/20 hover:text-red-400 transition-colors px-1">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6"><Disclaimer /></div>
    </div>
  );
}
