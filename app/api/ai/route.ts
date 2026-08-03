import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

async function callGroq(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama3-8b-8192",
      max_tokens: 512,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    // Try to parse a JSON error body, fall back to text
    let parsed: any;
    try {
      parsed = await res.json();
    } catch (e) {
      parsed = await res.text();
    }
    const message = parsed?.error?.message ?? parsed ?? `Groq API error (status ${res.status})`;
    const err = new Error(message);
    // attach status for richer logging upstream
    // @ts-ignore
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "No response";
}

export async function POST(req: NextRequest) {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  // Early configuration check: make it explicit if the key is missing
  if (!process.env.GROQ_API_KEY) {
    logger.error("ai/groq", new Error("GROQ_API_KEY is not set in environment"));
    return NextResponse.json(
      { error: "AI assistant is unavailable: server is not configured (GROQ_API_KEY missing). Please set GROQ_API_KEY in your environment." },
      { status: 500 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch (e: any) {
    logger.error("ai/groq", e);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { query } = body;
  if (!query?.trim()) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  try {
    // Gather real-time context from DB to give AI accurate data
    const [bills, topItems, settings] = await Promise.all([
      prisma.bill.findMany({
        where: {
          paymentStatus: "PAID",
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        include: {
          order: { include: { items: { include: { menuItem: true } } } },
        },
      }),
      prisma.orderItem.groupBy({
        by: ["menuItemId"],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
      prisma.settings.findFirst(),
    ]);

    const totalRevenue = bills.reduce((s: number, b) => s + b.total, 0);
    const todayBills = bills.filter(
      (b) => new Date(b.createdAt).toDateString() === new Date().toDateString()
    );
    const todayRevenue = todayBills.reduce((s: number, b) => s + b.total, 0);

    // Get top item names
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: topItems.map((i) => i.menuItemId) } },
      select: { id: true, name: true, price: true },
    });
    const topItemsFormatted = topItems.map((t) => {
      const item = menuItems.find((m) => m.id === t.menuItemId);
      return `${item?.name ?? "Unknown"} (qty: ${t._sum.quantity ?? 0})`;
    });

    const systemPrompt = `You are a smart restaurant assistant for "${settings?.restaurantName ?? "this restaurant"}".
You have access to real-time data and answer questions in a friendly, concise way (2-3 sentences max).

Current data (last 7 days):
- Total revenue: ₹${totalRevenue.toFixed(2)}
- Today's revenue: ₹${todayRevenue.toFixed(2)}
- Today's orders: ${todayBills.length}
- Top selling items: ${topItemsFormatted.join(", ") || "No data yet"}
- GST rate: ${(settings?.cgstPercent ?? 2.5) + (settings?.sgstPercent ?? 2.5)}%

Answer only about restaurant operations, sales, menu, billing topics. Always respond in English. Keep it brief and actionable.`;

    try {
      const answer = await callGroq(systemPrompt, query);
      return NextResponse.json({ answer });
    } catch (err: any) {
      // Log rich details but don't leak secrets in responses
      logger.error("ai/groq", {
        message: err?.message ?? String(err),
        status: err?.status ?? null,
        stack: err?.stack ?? null,
      });

      // Provide a helpful but non-sensitive error message to clients
      const clientMessage = err?.message?.includes("GROQ_API_KEY")
        ? "AI assistant misconfigured (missing API key)."
        : "AI assistant is unavailable right now. Please try again later.";

      return NextResponse.json(
        { error: clientMessage },
        { status: err?.status && Number.isInteger(err.status) ? err.status : 500 }
      );
    }
  } catch (dbErr: any) {
    logger.error("ai/groq-db", dbErr);
    return NextResponse.json({ error: "Failed to gather restaurant data" }, { status: 500 });
  }
}
