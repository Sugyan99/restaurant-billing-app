import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function POST(req: NextRequest) {
  return safeHandler("tables/transfer/POST", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER", "CASHIER"]);
    if (isAuthError(session)) return session;
    const { fromTableId, toTableId } = await req.json();
    if (!fromTableId || !toTableId) {
      return NextResponse.json({ error: "fromTableId and toTableId required" }, { status: 400 });
    }

    const result = await withTenant(session.tenantId, session.userId, async (tx) => {
      const toTable = await tx.restaurantTable.findUnique({ where: { id: toTableId } });
      if (!toTable) return { notFound: true } as const;
      if (toTable.status === "OCCUPIED") return { occupied: true } as const;

      await tx.order.updateMany({
        where: { tableId: fromTableId, status: { in: ["PENDING", "PREPARING", "READY"] }, tenantId: session.tenantId },
        data: { tableId: toTableId },
      });
      await tx.restaurantTable.update({ where: { id: fromTableId }, data: { status: "FREE" } });
      await tx.restaurantTable.update({ where: { id: toTableId }, data: { status: "OCCUPIED" } });
      return { success: true } as const;
    });

    if ("notFound" in result) return NextResponse.json({ error: "Destination table not found" }, { status: 404 });
    if ("occupied" in result) return NextResponse.json({ error: "Destination table is occupied" }, { status: 400 });
    return NextResponse.json({ success: true });
  });
}
