import { NextResponse } from "next/server";
import { listAlerts, addAlert, deleteAlert } from "@/lib/priceAlertStore";

export const dynamic = "force-dynamic";

export async function GET() {
  const alerts = await listAlerts();
  return NextResponse.json(alerts);
}

export async function POST(req: Request) {
  try {
    const { targetPrice, condition, chatId, note } = await req.json();
    if (!targetPrice || !condition || !chatId) {
      return NextResponse.json({ error: "targetPrice, condition, chatId required" }, { status: 400 });
    }
    const alert = await addAlert({ targetPrice: parseFloat(targetPrice), condition, chatId, note: note ?? "" });
    return NextResponse.json(alert);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await deleteAlert(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
