import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { auditLog } from "@/lib/billingEngine";
import { z } from "zod";

const schema = z.object({ reason: z.string().min(1, "Void reason required") });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("bills/[id]/void/POST", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;
    const { id } = await params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Void reason required" }, { status: 400 });

    return withTenant(session.tenantId, session.userId, async (tx) => {
      const bill = await tx.bill.findFirst({
        where: { id, tenantId: session.tenantId },
        include: { order: { include: { table: true } } },
      });
      if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
      if (bill.paymentStatus === "PAID") return NextResponse.json({ error: "Cannot void a paid bill — use Refund instead" }, { status: 400 });
      if ((bill as any).billStatus === "VOID") return NextResponse.json({ error: "Bill already voided" }, { status: 400 });

      await (tx.bill as any).update({ where: { id }, data: { billStatus: "VOID", voidReason: parsed.data.reason } });
      await tx.order.update({ where: { id: bill.orderId }, data: { status: "READY" } });
      if (bill.order.tableId) {
        await tx.restaurantTable.update({ where: { id: bill.order.tableId }, data: { status: "OCCUPIED" } });
      }
      await auditLog(tx as any, "BILL_VOIDED", bill.orderId, session.userId, session.tenantId, { reason: parsed.data.reason });
      return NextResponse.json({ success: true });
    });
  });
}
