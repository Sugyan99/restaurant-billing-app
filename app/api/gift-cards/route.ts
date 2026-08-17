import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { randomUUID } from "crypto";

function genCode() {
  return "GC-" + Math.random().toString(36).toUpperCase().slice(2, 10);
}

function newId() {
  return randomUUID().replace(/-/g, "").slice(0, 25);
}

export async function GET(req: NextRequest) {
  return safeHandler("gift-cards/GET", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER", "CASHIER"]);
    if (isAuthError(session)) return session;
    const cards = await withTenant(session.tenantId, session.userId, (tx) =>
      tx.giftCard.findMany({
        where: { tenantId: session.tenantId },
        orderBy: { purchasedAt: "desc" },
        include: { transactions: { orderBy: { createdAt: "desc" }, take: 5 } },
      })
    );
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
    const card = await withTenant(session.tenantId, session.userId, (tx) =>
      tx.giftCard.create({
        data: {
          id: newId(),
          tenantId: session.tenantId,
          code,
          initialValue,
          balance: initialValue,
          recipientName: recipientName || null,
          recipientPhone: recipientPhone || null,
          purchasedById: session.userId,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          transactions: {
            create: {
              id: newId(),
              tenantId: session.tenantId,
              type: "ISSUE",
              amount: initialValue,
              balanceAfter: initialValue,
              note: "Gift card issued",
            },
          },
        },
      })
    );
    return NextResponse.json({ card });
  });
}
