import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

// POST: merge secondaryTableId into primaryTableId
export async function POST(req: NextRequest) {
  return safeHandler("tables/merge/POST", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER", "CASHIER"]);
    if (isAuthError(session)) return session;
    const { primaryTableId, secondaryTableId } = await req.json();
    if (!primaryTableId || !secondaryTableId || primaryTableId === secondaryTableId) {
      return NextResponse.json({ error: "Invalid table IDs" }, { status: 400 });
    }
    await prisma.restaurantTable.update({
      where: { id: secondaryTableId },
      data: { mergedWith: primaryTableId },
    });
    return NextResponse.json({ success: true });
  });
}

// DELETE: split (unmerge) a table
export async function DELETE(req: NextRequest) {
  return safeHandler("tables/merge/DELETE", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER", "CASHIER"]);
    if (isAuthError(session)) return session;
    const { tableId } = await req.json();
    if (!tableId) return NextResponse.json({ error: "tableId required" }, { status: 400 });
    await prisma.restaurantTable.update({
      where: { id: tableId },
      data: { mergedWith: null },
    });
    return NextResponse.json({ success: true });
  });
}
