import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

function genCode() {
  return "GC-" + Math.random().toString(36).toUpperCase().slice(2, 10);
}

export async function GET(req: NextRequest) {
  return safeHandler("gift-cards/GET", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER", "CASHIER"]);
    if (isAuthError(session)) return session;
    const cards = await (prisma as any).giftCard.findMany({
      orderBy: { purchasedAt: "desc" },
      include: { transactions: { orderBy: { createdAt: "desc" }, take: 5 } },
    });
    return NextResponse.json({ cards });
  });
}

export async function POST(req: NextRequest) {
  return safeHandler("gift-cards/POST", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER", "CASHIER"]);
    if (isAuthError(session)) return session;
    const body = await req.json();
    const { initialValue, recipientName, recipientPhone, expiresAt } = body;
    if (!initialValue || initialValue <= 0) return NextResponse.json({ error: "Invalid value" }, { status: 400 });
    const code = genCode();
    const card = await (prisma as any).giftCard.create({
      data: {
        id: require("crypto").randomUUID().replace(/-/g, "").slice(0, 24),
        code,
        initialValue,
        balance: initialValue,
        recipientName,
        recipientPhone,
        purchasedById: session.userId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        transactions: {
          create: {
            id: require("crypto").randomUUID().replace(/-/g, "").slice(0, 24),
            type: "ISSUE",
            amount: initialValue,
            balanceAfter: initialValue,
            note: "Gift card issued",
          },
        },
      },
    });
    return NextResponse.json({ card });
  });
}
