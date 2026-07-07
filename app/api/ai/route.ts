import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

async function callGroq(systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
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
    const err = await res.json();
    throw new Error(err.error?.message ?? "Groq API error");
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "No response";
}

export async function POST(req: NextRequest) {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const { query } = await req.json();
  if (!query?.trim()) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

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

Answer only about restaurant operations, sales, menu, billing topics. Respond in the same language the user uses (Hindi/English/Hinglish). Keep it brief and actionable.`;

  try {
    const answer = await callGroq(systemPrompt, query);
    return NextResponse.json({ answer });
  } catch (err: any) {
    console.error("Groq error:", err);
    return NextResponse.json(
      { error: "AI assistant is unavailable right now. Check GROQ_API_KEY in your .env" },
      { status: 500 }
    );
  }
}
