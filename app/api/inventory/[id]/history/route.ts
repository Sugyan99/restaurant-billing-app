import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return safeHandler("inventory/[id]/history/GET", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;
    const { id } = await params;
    const transactions = await withTenant(session.tenantId, session.userId, (tx) =>
      tx.stockTransaction.findMany({
        where: { inventoryItemId: id, tenantId: session.tenantId },
        orderBy: { createdAt: "desc" },
        take: 200,
      })
    );
    return NextResponse.json({ transactions });
  });
}
