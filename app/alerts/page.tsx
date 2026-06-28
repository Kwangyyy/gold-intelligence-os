"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/shared";
import { ALERT_TYPES, evaluateAlert, needsValue, type Alert, type AlertType } from "@/lib/alerts";
import type { Bilingual, MarketSnapshot } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";

const STORE_ALERTS   = "gios.alerts";
const STORE_TIMELINE = "gios.alertTimeline";
const STORE_WEBHOOK  = "gios.webhookUrl";
const STORE_TG_TOKEN = "gios.tgToken";
const STORE_TG_CHAT  = "gios.tgChatId";

interface TriggerLog {
  id: string;
  type: AlertType;
  message: Bilingual;
  at: number;
}

export default function AlertsPage() {
  const { t, tb, lang } = useI18n();
  const [alerts, setAlerts]     = useState<Alert[]>([]);
  const [timeline, setTimeline] = useState<TriggerLog[]>([]);
  const [formType, setFormType] = useState<AlertType>("price_above");
  const [formValue, setFormValue] = useState<number>(0);
  const [notif, setNotif]       = useState(false);
  const [price, setPrice]       = useState<number>(0);

  // webhook state
  const [webhookUrl, setWebhookUrl]     = useState("");
  const [webhookInput, setWebhookInput] = useState("");
  const [webhookSaved, setWebhookSaved] = useState(false);
  const webhookRef = useRef("");
  webhookRef.current = webhookUrl;

  // Telegram state
  const [tgToken, setTgToken]     = useState("");
  const [tgChatId, setTgChatId]   = useState("");
  const [tgInput, setTgInput]     = useState({ token: "", chatId: "" });
  const [tgSaved, setTgSaved]     = useState(false);
  const tgRef = useRef({ token: "", chatId: "" });
  tgRef.current = { token: tgToken, chatId: tgChatId };

  const alertsRef = useRef<Alert[]>([]);
  const recoRef   = useRef<string | undefined>(undefined);
  alertsRef.current = alerts;
  const langRef = useRef(lang);
  langRef.current = lang;

  // Load persisted state.
  useEffect(() => {
    try {
      const a   = localStorage.getItem(STORE_ALERTS);
      const tl  = localStorage.getItem(STORE_TIMELINE);
      const wh  = localStorage.getItem(STORE_WEBHOOK) ?? "";
      const tok = localStorage.getItem(STORE_TG_TOKEN) ?? "";
      const cid = localStorage.getItem(STORE_TG_CHAT)  ?? "";
      if (a)  setAlerts(JSON.parse(a));
      if (tl) setTimeline(JSON.parse(tl));
      setWebhookUrl(wh);
      setWebhookInput(wh);
      setTgToken(tok);
      setTgChatId(cid);
      setTgInput({ token: tok, chatId: cid });
    } catch {
      /* ignore */
    }
    if (typeof Notification !== "undefined") setNotif(Notification.permission === "granted");
  }, []);

  useEffect(() => { localStorage.setItem(STORE_ALERTS,   JSON.stringify(alerts));   }, [alerts]);
  useEffect(() => { localStorage.setItem(STORE_TIMELINE, JSON.stringify(timeline)); }, [timeline]);

  const saveWebhook = () => {
    const url = webhookInput.trim();
    setWebhookUrl(url);
    localStorage.setItem(STORE_WEBHOOK, url);
    setWebhookSaved(true);
    setTimeout(() => setWebhookSaved(false), 1800);
  };

  const saveTelegram = () => {
    const { token, chatId } = tgInput;
    setTgToken(token.trim());
    setTgChatId(chatId.trim());
    localStorage.setItem(STORE_TG_TOKEN, token.trim());
    localStorage.setItem(STORE_TG_CHAT, chatId.trim());
    setTgSaved(true);
    setTimeout(() => setTgSaved(false), 1800);
  };

  const testTelegram = () => {
    const { token, chatId } = tgInput;
    if (!token || !chatId) return;
    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "🔔 <b>Gold Intelligence OS</b>\nทดสอบการเชื่อมต่อ Telegram สำเร็จ!\n\nTelegram test successful.",
        parse_mode: "HTML",
      }),
    }).catch(() => {});
  };

  const fireTelegram = useCallback((msg: Bilingual) => {
    const { token, chatId } = tgRef.current;
    if (!token || !chatId) return;
    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🔔 <b>Gold Intelligence OS Alert</b>\n${msg.th}\n\n${msg.en}`,
        parse_mode: "HTML",
      }),
    }).catch(() => {});
  }, []);

  const testWebhook = () => {
    const url = webhookInput.trim();
    if (!url) return;
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "Gold Intelligence OS",
        event: "test",
        message: "Gold Intelligence OS — webhook test successful",
        messageTh: "Gold Intelligence OS — ทดสอบ webhook สำเร็จ",
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {});
  };

  const fireWebhook = useCallback((msg: Bilingual) => {
    const url = webhookRef.current;
    if (!url) return;
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "Gold Intelligence OS",
        event: "alert_triggered",
        message: msg.en,
        messageTh: msg.th,
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {});
  }, []);

  const poll = useCallback(async () => {
    let snap: MarketSnapshot;
    try {
      const res = await fetch("/api/market/xauusd", { cache: "no-store" });
      snap = await res.json();
    } catch {
      return;
    }
    setPrice(snap.price);

    const triggers: { id: string; type: AlertType; message: Bilingual }[] = [];
    for (const a of alertsRef.current) {
      if (a.triggered) continue;
      const msg = evaluateAlert(a, { snapshot: snap, prevReco: recoRef.current });
      if (msg) triggers.push({ id: a.id, type: a.type, message: msg });
    }
    recoRef.current = snap.recommendation.label;

    if (triggers.length) {
      const now = Date.now();
      setAlerts((prev) =>
        prev.map((a) => {
          const hit = triggers.find((x) => x.id === a.id);
          return hit ? { ...a, triggered: true, triggeredAt: now, message: hit.message } : a;
        })
      );
      setTimeline((prev) => [...triggers.map((x) => ({ ...x, at: now })), ...prev].slice(0, 50));

      // Browser notification
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        triggers.forEach((x) =>
          new Notification("Gold Intelligence OS", { body: x.message[langRef.current] })
        );
      }
      // Webhook + Telegram
      triggers.forEach((x) => { fireWebhook(x.message); fireTelegram(x.message); });
    }
  }, [fireWebhook, fireTelegram]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 15_000);
    return () => clearInterval(id);
  }, [poll]);

  const addAlert = () => {
    const a: Alert = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: formType,
      value: needsValue(formType) ? formValue : undefined,
      createdAt: Date.now(),
      triggered: false,
    };
    setAlerts((prev) => [a, ...prev]);
  };

  const enableNotif = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setNotif(p === "granted");
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title={t("alertsTitle")}
        subtitle={t("alertsSubtitle")}
        right={
          <span className="text-xs text-silver/50">
            {t("alWatching")}: <span className="font-mono text-gold">{price ? price.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"}</span>
          </span>
        }
      />

      {/* Create form */}
      <Card className="mb-6">
        <div className="stat-label mb-3">{t("alCreate")}</div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="stat-label mb-1 block">{t("alType")}</label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value as AlertType)}
              className="rounded-lg border border-base-border bg-base-panel px-3 py-2 text-sm text-silver outline-none focus:border-neon/50"
            >
              {ALERT_TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {t(`al_${ty}` as never)}
                </option>
              ))}
            </select>
          </div>
          {needsValue(formType) && (
            <div>
              <label className="stat-label mb-1 block">{t("alValue")}</label>
              <input
                type="number"
                value={Number.isFinite(formValue) ? formValue : ""}
                onChange={(e) => setFormValue(parseFloat(e.target.value) || 0)}
                className="w-32 rounded-lg border border-base-border bg-base-panel px-3 py-2 font-mono text-sm text-silver outline-none focus:border-neon/50"
              />
            </div>
          )}
          <button onClick={addAlert} className="rounded-lg bg-neon/20 px-5 py-2 text-sm font-semibold text-neon hover:bg-neon/30">
            {t("alAdd")}
          </button>
          <button
            onClick={enableNotif}
            disabled={notif}
            className="rounded-lg border border-base-border px-3 py-2 text-xs text-silver/70 hover:text-silver disabled:opacity-50"
          >
            {notif ? `✓ ${t("alNotifOn")}` : t("alEnableNotif")}
          </button>
        </div>
      </Card>

      {/* Telegram config */}
      <Card className="mb-6">
        <div className="stat-label mb-3">{t("alTelegramTitle")}</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="stat-label mb-1 block">{t("alTelegramToken")}</label>
            <input
              type="password"
              value={tgInput.token}
              onChange={(e) => setTgInput((p) => ({ ...p, token: e.target.value }))}
              placeholder="123456789:AAB..."
              className="w-full rounded-lg border border-base-border bg-base-panel px-3 py-2 text-sm text-silver outline-none focus:border-neon/50 font-mono"
            />
          </div>
          <div>
            <label className="stat-label mb-1 block">{t("alTelegramChatId")}</label>
            <input
              type="text"
              value={tgInput.chatId}
              onChange={(e) => setTgInput((p) => ({ ...p, chatId: e.target.value }))}
              placeholder="-100xxxxxxxxxx"
              className="w-full rounded-lg border border-base-border bg-base-panel px-3 py-2 text-sm text-silver outline-none focus:border-neon/50 font-mono"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={saveTelegram}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tgSaved
                ? "bg-bull/20 text-bull border border-bull/40"
                : "bg-neon/15 text-neon border border-neon/30 hover:bg-neon/25"
            }`}
          >
            {tgSaved ? t("alTelegramSaved") : "บันทึก Telegram"}
          </button>
          {tgInput.token && tgInput.chatId && (
            <button
              onClick={testTelegram}
              className="rounded-lg border border-base-border px-4 py-2 text-sm text-silver/70 hover:text-silver transition-colors"
            >
              ส่งข้อความทดสอบ
            </button>
          )}
        </div>
        <p className="mt-3 text-[11px] text-silver/40">{t("alTelegramNote")}</p>
        {tgToken && tgChatId && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-bull">
            <span className="h-1.5 w-1.5 rounded-full bg-bull" />
            {t("alTelegramActive")}
          </div>
        )}
      </Card>

      {/* Webhook config */}
      <Card className="mb-6">
        <div className="stat-label mb-3">{t("alWebhookTitle")}</div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="stat-label mb-1 block">{t("alWebhookUrl")}</label>
            <input
              type="url"
              value={webhookInput}
              onChange={(e) => setWebhookInput(e.target.value)}
              placeholder="https://hooks.zapier.com/... or https://api.telegram.org/bot.../sendMessage"
              className="w-full rounded-lg border border-base-border bg-base-panel px-3 py-2 text-sm text-silver outline-none focus:border-neon/50"
            />
          </div>
          <button
            onClick={saveWebhook}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              webhookSaved
                ? "bg-bull/20 text-bull border border-bull/40"
                : "bg-neon/15 text-neon border border-neon/30 hover:bg-neon/25"
            }`}
          >
            {webhookSaved ? t("alWebhookSaved") : t("alWebhookSave")}
          </button>
          {webhookInput && (
            <button
              onClick={testWebhook}
              className="rounded-lg border border-base-border px-4 py-2 text-sm text-silver/70 hover:text-silver transition-colors"
            >
              {t("alWebhookTest")}
            </button>
          )}
        </div>
        <p className="mt-3 text-[11px] text-silver/40">{t("alWebhookNote")}</p>
        {webhookUrl && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-bull">
            <span className="h-1.5 w-1.5 rounded-full bg-bull" />
            {t("alWebhookActive")}
          </div>
        )}
      </Card>

      {/* Active / configured alerts */}
      <Card className="mb-6 p-0">
        <div className="border-b border-base-border px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-neon/80">
          {t("alActive")}
        </div>
        {alerts.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-silver/40">{t("alNoAlerts")}</div>
        ) : (
          <ul className="divide-y divide-base-border/40">
            {alerts.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className={`h-2 w-2 rounded-full ${a.triggered ? "bg-warn" : "bg-bull live-dot"}`} />
                <span className="font-medium text-silver">
                  {t(`al_${a.type}` as never)}
                  {a.value != null ? ` · ${a.value.toLocaleString()}` : ""}
                </span>
                <span className={`ml-auto text-xs ${a.triggered ? "text-warn" : "text-bull"}`}>
                  {a.triggered ? t("alTriggered") : t("alActive")}
                </span>
                {a.triggered && (
                  <button
                    onClick={() => setAlerts((prev) => prev.map((x) => (x.id === a.id ? { ...x, triggered: false, triggeredAt: undefined, message: undefined } : x)))}
                    className="rounded border border-base-border px-2 py-0.5 text-[11px] text-silver/60 hover:text-silver"
                  >
                    {t("alRearm")}
                  </button>
                )}
                <button
                  onClick={() => setAlerts((prev) => prev.filter((x) => x.id !== a.id))}
                  className="rounded border border-bear/30 px-2 py-0.5 text-[11px] text-bear/80 hover:text-bear"
                >
                  {t("alDelete")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Triggered timeline */}
      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-base-border px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gold/80">{t("alTimeline")}</span>
          {timeline.length > 0 && (
            <button onClick={() => setTimeline([])} className="text-[11px] text-silver/50 hover:text-silver">
              {t("alClear")}
            </button>
          )}
        </div>
        {timeline.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-silver/40">{t("alNoTriggers")}</div>
        ) : (
          <ul className="divide-y divide-base-border/40">
            {timeline.map((tl, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                <span className="mt-0.5 text-warn">🔔</span>
                <div className="min-w-0 flex-1">
                  <div className="text-silver/85">{tb(tl.message)}</div>
                  <div className="text-[11px] text-silver/40">
                    {new Date(tl.at).toLocaleString(lang === "th" ? "th-TH" : "en-US")}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
