import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { safeHandler } from "@/lib/apiHandler";

export async function GET(req: NextRequest) {
  return safeHandler("data-management/GET", async () => {
    const session = requireAuth(req, ["OWNER"]);
    if (isAuthError(session)) return session;
    const tid = session.tenantId;

    const [orders, bills, expenses, customers, reservations, dayCloses] = await withTenant(session.tenantId, session.userId, (tx) => Promise.all([
      tx.order.count({ where: { tenantId: tid } }),
      tx.bill.count({ where: { tenantId: tid } }),
      tx.expense.count({ where: { tenantId: tid } }),
      tx.customer.count({ where: { tenantId: tid } }),
      tx.reservation.count({ where: { tenantId: tid } }),
      tx.dayClose.count({ where: { tenantId: tid } }),
    ]));

    return NextResponse.json({ counts: { orders, bills, expenses, customers, reservations, dayCloses } });
  });
}

export async function DELETE(req: NextRequest) {
  return safeHandler("data-management/DELETE", async () => {
    const session = requireAuth(req, ["OWNER"]);
    if (isAuthError(session)) return session;
    const tid = session.tenantId;

    const { type, before } = await req.json();
    if (!type || !before) return NextResponse.json({ error: "Type and before date required" }, { status: 400 });

    const beforeDate = new Date(before);

    if (!["orders", "expenses", "reservations", "dayCloses"].includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const deleted = await withTenant(session.tenantId, session.userId, async (tx) => {
      if (type === "orders") {
        const orders = await tx.order.findMany({
          where: { tenantId: tid, createdAt: { lt: beforeDate }, status: { in: ["SERVED", "CANCELLED"] } },
          select: { id: true },
        });
        const ids = orders.map(o => o.id);
        if (!ids.length) return 0;
        await tx.bill.deleteMany({ where: { tenantId: tid, orderId: { in: ids } } });
        const r = await tx.order.deleteMany({ where: { tenantId: tid, id: { in: ids } } });
        return r.count;
      } else if (type === "expenses") {
        const r = await tx.expense.deleteMany({ where: { tenantId: tid, date: { lt: beforeDate } } });
        return r.count;
      } else if (type === "reservations") {
        const r = await tx.reservation.deleteMany({ where: { tenantId: tid, date: { lt: beforeDate }, status: { in: ["CANCELLED", "NO_SHOW"] } } });
        return r.count;
      } else {
        const r = await tx.dayClose.deleteMany({ where: { tenantId: tid, date: { lt: beforeDate } } });
        return r.count;
      }
    });

    return NextResponse.json({ deleted, type });
  });
}
