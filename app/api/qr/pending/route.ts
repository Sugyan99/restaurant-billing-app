import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  return safeHandler("qr/pending/GET", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;

    const orders = await withTenant(session.tenantId, session.userId, (tx) => tx.qrOrder.findMany({
      where: { tenantId: session.tenantId, status: "PENDING" },
      orderBy: { createdAt: "asc" },
    }));

    return NextResponse.json({ orders });
  });
}
