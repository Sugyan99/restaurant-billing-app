import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function POST(req: NextRequest) {
  return safeHandler("tables/transfer/POST", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER", "STAFF"]);
    if (isAuthError(session)) return session;
    const { fromTableId, toTableId } = await req.json();
    if (!fromTableId || !toTableId) {
      return NextResponse.json({ error: "fromTableId and toTableId required" }, { status: 400 });
    }
    const toTable = await prisma.restaurantTable.findUnique({ where: { id: toTableId } });
    if (!toTable) return NextResponse.json({ error: "Destination table not found" }, { status: 404 });
    if (toTable.status === "OCCUPIED") {
      return NextResponse.json({ error: "Destination table is occupied" }, { status: 400 });
    }
    // Move all active orders
    await prisma.order.updateMany({
      where: { tableId: fromTableId, status: { in: ["PENDING", "PREPARING", "READY"] } },
      data: { tableId: toTableId },
    });
    // Update statuses
    await prisma.restaurantTable.update({ where: { id: fromTableId }, data: { status: "FREE" } });
    await prisma.restaurantTable.update({ where: { id: toTableId }, data: { status: "OCCUPIED" } });
    return NextResponse.json({ success: true });
  });
}
