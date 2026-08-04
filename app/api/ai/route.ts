import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

async function getGroqKey(): Promise<{ key: string; model: string } | null> {
  // 1. Env var takes priority
  if (process.env.GROQ_API_KEY) {
    return { key: process.env.GROQ_API_KEY, model: "llama3-8b-8192" };
  }
  // 2. Fallback: DB setting
  try {
    const settings = await prisma.settings.findFirst({
      select: { groqApiKey: true, groqModel: true, aiEnabled: true },
    });
    if (settings?.aiEnabled === false) return null;
    if (settings?.groqApiKey) {
      return { key: settings.groqApiKey, model: settings.groqModel ?? "llama3-8b-8192" };
    }
  } catch { /* ignore */ }
  return null;
}

async function callGroq(apiKey: string, model: string, systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    let parsed: Record<string, unknown> | string;
    try { parsed = await res.json(); } catch { parsed = await res.text(); }
    const msg = (parsed as Record<string, Record<string, string>>)?.error?.message ?? String(parsed) ?? `Groq error ${res.status}`;
    const err = new Error(msg) as Error & { status: number };
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "No response";
}

export async function POST(req: NextRequest) {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const cfg = await getGroqKey();
  if (!cfg) {
    return NextResponse.json(
      { error: "AI assistant is not configured. Please add your Groq API key in Settings → AI Assistant." },
      { status: 503 }
    );
  }

  let body: { query?: string; autoAnalyze?: boolean };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { query, autoAnalyze } = body;
  if (!query?.trim() && !autoAnalyze) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  try {
    const [bills, topItems, settings, pendingOrders] = await Promise.all([
      prisma.bill.findMany({
        where: { paymentStatus: "PAID", createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        include: { order: { include: { items: { include: { menuItem: true } } } } },
      }),
      prisma.orderItem.groupBy({
        by: ["menuItemId"], _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } }, take: 5,
      }),
      prisma.settings.findFirst(),
      prisma.order.count({ where: { status: "PENDING" } }),
    ]);

    const totalRevenue = bills.reduce((s: number, b) => s + b.total, 0);
    const todayBills = bills.filter(b => new Date(b.createdAt).toDateString() === new Date().toDateString());
    const todayRevenue = todayBills.reduce((s: number, b) => s + b.total, 0);
    const yesterdayBills = bills.filter(b => {
      const d = new Date(); d.setDate(d.getDate() - 1);
      return new Date(b.createdAt).toDateString() === d.toDateString();
    });
    const yesterdayRevenue = yesterdayBills.reduce((s: number, b) => s + b.total, 0);

    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: topItems.map(i => i.menuItemId) } },
      select: { id: true, name: true, price: true },
    });
    const topItemsFormatted = topItems.map(t => {
      const item = menuItems.find(m => m.id === t.menuItemId);
      return `${item?.name ?? "Unknown"} (qty: ${t._sum.quantity ?? 0})`;
    });

    const trend = yesterdayRevenue > 0
      ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100).toFixed(1)
      : "N/A";

    const systemPrompt = `You are a smart restaurant business assistant for "${settings?.restaurantName ?? "this restaurant"}".
You have real-time data and give concise, actionable insights (2-4 sentences). Be conversational and helpful.

Live Data:
- Today's revenue: ₹${todayRevenue.toFixed(0)} (${trend !== "N/A" ? (parseFloat(trend) >= 0 ? "+" : "") + trend + "% vs yesterday" : "no comparison yet"})
- Today's orders: ${todayBills.length}
- Yesterday's revenue: ₹${yesterdayRevenue.toFixed(0)}
- This week's revenue: ₹${totalRevenue.toFixed(0)}
- Pending kitchen orders: ${pendingOrders}
- Top 5 items (7 days): ${topItemsFormatted.join(", ") || "No data yet"}
- GST rate: ${(settings?.cgstPercent ?? 2.5) + (settings?.sgstPercent ?? 2.5)}%

Rules: Only answer about restaurant operations, sales, menu, billing. Always in English. Be direct and helpful.`;

    const userMsg = autoAnalyze
      ? `Give me a smart business summary for today. Mention revenue trend, pending orders, and one actionable tip. Be brief and friendly.`
      : query!;

    try {
      const answer = await callGroq(cfg.key, cfg.model, systemPrompt, userMsg);
      return NextResponse.json({ answer });
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      logger.error("ai/groq", { message: e?.message, status: e?.status });
      const clientMsg = e?.message?.toLowerCase().includes("invalid api key")
        ? "Invalid Groq API key. Please update it in Settings → AI Assistant."
        : "AI is temporarily unavailable. Please try again.";
      return NextResponse.json({ error: clientMsg }, { status: 500 });
    }
  } catch (dbErr: unknown) {
    logger.error("ai/groq-db", dbErr);
    return NextResponse.json({ error: "Failed to load restaurant data" }, { status: 500 });
  }
}
