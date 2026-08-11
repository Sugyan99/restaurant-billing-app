import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { randomUUID } from "crypto";

type Ctx = { params: Promise<{ id: string }> };

function newId() {
  return randomUUID().replace(/-/g, "").slice(0, 25);
}

export async function GET(req: NextRequest, ctx: Ctx) {
  return safeHandler("gift-cards/[id]/GET", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER", "CASHIER"]);
    if (isAuthError(session)) return session;
    const { id } = await ctx.params;
    const card = await (prisma as any).giftCard.findFirst({
      where: { OR: [{ id }, { code: id }] },
      include: { transactions: { orderBy: { createdAt: "desc" } } },
    });
    if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ card });
  });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  return safeHandler("gift-cards/[id]/PUT", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER", "CASHIER"]);
    if (isAuthError(session)) return session;
    const { id } = await ctx.params;
    const body = await req.json();
    const { action, amount, orderId, note } = body;

    const card = await (prisma as any).giftCard.findUnique({ where: { id } });
    if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (action === "REDEEM") {
      if (!card.isActive) return NextResponse.json({ error: "Card is inactive" }, { status: 400 });
      if (card.expiresAt && new Date(card.expiresAt) < new Date())
        return NextResponse.json({ error: "Card expired" }, { status: 400 });
      if (amount > card.balance) return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
      const newBal = parseFloat((card.balance - amount).toFixed(2));
      await (prisma as any).giftCard.update({
        where: { id },
        data: {
          balance: newBal,
          transactions: {
            create: { id: newId(), type: "REDEEM", amount, balanceAfter: newBal, orderId: orderId || null, note: note ?? "Redeemed at POS" },
          },
        },
      });
      return NextResponse.json({ success: true, newBalance: newBal });
    }

    if (action === "TOPUP") {
      const newBal = parseFloat((card.balance + amount).toFixed(2));
      await (prisma as any).giftCard.update({
        where: { id },
        data: {
          balance: newBal,
          transactions: {
            create: { id: newId(), type: "TOPUP", amount, balanceAfter: newBal, note: note ?? "Top-up" },
          },
        },
      });
      return NextResponse.json({ success: true, newBalance: newBal });
    }

    if (action === "DEACTIVATE") {
      await (prisma as any).giftCard.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  });
}
