import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("bills/[id]/hold/POST", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER", "CASHIER"]);
    if (isAuthError(session)) return session;
    const { id } = await params;

    return withTenant(session.tenantId, session.userId, async (tx) => {
      const bill = await tx.bill.findFirst({ where: { id, tenantId: session.tenantId } });
      if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
      if ((bill as any).billStatus === "VOID") return NextResponse.json({ error: "Cannot hold a voided bill" }, { status: 400 });
      if (bill.paymentStatus === "PAID") return NextResponse.json({ error: "Cannot hold a paid bill" }, { status: 400 });

      const newStatus = (bill as any).billStatus === "HOLD" ? "ACTIVE" : "HOLD";
      await (tx.bill as any).update({ where: { id }, data: { billStatus: newStatus } });
      return NextResponse.json({ success: true, billStatus: newStatus });
    });
  });
}
