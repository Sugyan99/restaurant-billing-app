import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { safeHandler } from "@/lib/apiHandler";

/** GET /api/bills/draft?orderId=xxx — crash recovery endpoint */
export async function GET(req: NextRequest) {
  return safeHandler("bills/draft/GET", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER", "CASHIER"]);
    if (isAuthError(session)) return session;
    const orderId = new URL(req.url).searchParams.get("orderId");
    if (!orderId) return NextResponse.json({ draft: null });
    const draft = await withTenant(session.tenantId, session.userId, (tx) => tx.invoiceDraft.findFirst({
      where: { orderId, tenantId: session.tenantId },
    }));
    return NextResponse.json({ draft });
  });
}
