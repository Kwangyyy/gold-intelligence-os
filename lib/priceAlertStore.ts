import { Redis } from "@upstash/redis";

export type AlertCondition = "above" | "below";

export interface PriceAlert {
  id: string;
  targetPrice: number;
  condition: AlertCondition;
  chatId: string;
  note: string;
  createdAt: number;
  triggered: boolean;
  triggeredAt?: number;
}

const KEY = "gios:price-alerts";

function getRedis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function listAlerts(): Promise<PriceAlert[]> {
  const r = getRedis();
  if (!r) return [];
  const raw = await r.get<string>(KEY);
  if (!raw) return [];
  try { return typeof raw === "string" ? JSON.parse(raw) : (raw as PriceAlert[]); } catch { return []; }
}

async function saveAlerts(alerts: PriceAlert[]): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.set(KEY, JSON.stringify(alerts));
}

export async function addAlert(alert: Omit<PriceAlert, "id" | "createdAt" | "triggered">): Promise<PriceAlert> {
  const alerts = await listAlerts();
  const newAlert: PriceAlert = { ...alert, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), createdAt: Date.now(), triggered: false };
  alerts.push(newAlert);
  await saveAlerts(alerts);
  return newAlert;
}

export async function deleteAlert(id: string): Promise<void> {
  const alerts = await listAlerts();
  await saveAlerts(alerts.filter(a => a.id !== id));
}

// Check all untriggered alerts against current price.
// Returns alerts that just fired (for the caller to send Telegram).
export async function checkAndTrigger(currentPrice: number): Promise<PriceAlert[]> {
  const alerts = await listAlerts();
  const fired: PriceAlert[] = [];
  let changed = false;
  for (const a of alerts) {
    if (a.triggered) continue;
    const hit = a.condition === "above" ? currentPrice >= a.targetPrice : currentPrice <= a.targetPrice;
    if (hit) {
      a.triggered = true;
      a.triggeredAt = Date.now();
      fired.push(a);
      changed = true;
    }
  }
  if (changed) await saveAlerts(alerts);
  return fired;
}
