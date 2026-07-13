import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { safeHandler } from "@/lib/apiHandler";

export async function GET(req: NextRequest) {
  return safeHandler("data-management/GET", async () => {
    const session = requireAuth(req, ["OWNER"]);
    if (isAuthError(session)) return session;

    const [orders, bills, expenses, customers, reservations, dayCloses] = await Promise.all([
      prisma.order.count(),
      prisma.bill.count(),
      prisma.expense.count(),
      prisma.customer.count(),
      prisma.reservation.count(),
      prisma.dayClose.count(),
    ]);

    return NextResponse.json({ counts: { orders, bills, expenses, customers, reservations, dayCloses } });
  });
}

export async function DELETE(req: NextRequest) {
  return safeHandler("data-management/DELETE", async () => {
    const session = requireAuth(req, ["OWNER"]);
    if (isAuthError(session)) return session;

    const { type, before } = await req.json();
    if (!type || !before) return NextResponse.json({ error: "Type and before date required" }, { status: 400 });

    const beforeDate = new Date(before);
    let deleted = 0;

    if (type === "orders") {
      // Delete bills first (FK), then order items (cascade), then orders
      const orders = await prisma.order.findMany({
        where: { createdAt: { lt: beforeDate }, status: { in: ["SERVED", "CANCELLED"] } },
        select: { id: true },
      });
      const ids = orders.map(o => o.id);
      await prisma.bill.deleteMany({ where: { orderId: { in: ids } } });
      const r = await prisma.order.deleteMany({ where: { id: { in: ids } } });
      deleted = r.count;
    } else if (type === "expenses") {
      const r = await prisma.expense.deleteMany({ where: { date: { lt: beforeDate } } });
      deleted = r.count;
    } else if (type === "reservations") {
      const r = await prisma.reservation.deleteMany({
        where: { date: { lt: beforeDate }, status: { in: ["CANCELLED", "NO_SHOW"] } },
      });
      deleted = r.count;
    } else if (type === "dayCloses") {
      const r = await prisma.dayClose.deleteMany({ where: { date: { lt: beforeDate } } });
      deleted = r.count;
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    return NextResponse.json({ deleted, type });
  });
}
