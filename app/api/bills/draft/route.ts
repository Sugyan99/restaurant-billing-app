import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { safeHandler } from "@/lib/apiHandler";
import { getDraft } from "@/lib/billingEngine";

/** GET /api/bills/draft?orderId=xxx — crash recovery endpoint */
export async function GET(req: NextRequest) {
  return safeHandler("bills/draft/GET", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER", "CASHIER"]);
    if (isAuthError(session)) return session;
    const orderId = new URL(req.url).searchParams.get("orderId");
    if (!orderId) return NextResponse.json({ draft: null });
    const draft = await getDraft(prisma, orderId);
    return NextResponse.json({ draft });
  });
}
