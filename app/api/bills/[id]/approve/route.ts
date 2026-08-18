import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { auditLog } from "@/lib/billingEngine";
import { z } from "zod";

const schema = z.object({ action: z.enum(["APPROVE", "REJECT"]) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("bills/[id]/approve/POST", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;
    const { id } = await params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Action must be APPROVE or REJECT" }, { status: 400 });

    return withTenant(session.tenantId, session.userId, async (tx) => {
      const bill = await tx.bill.findFirst({ where: { id, tenantId: session.tenantId } });
      if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
      if ((bill as any).discountApprovalStatus !== "PENDING") {
        return NextResponse.json({ error: "No pending discount approval on this bill" }, { status: 400 });
      }

      const updateData: Record<string, unknown> = {
        discountApprovalStatus: parsed.data.action === "APPROVE" ? "APPROVED" : "REJECTED",
        discountApprovedBy: session.userId,
      };
      if (parsed.data.action === "REJECT") {
        updateData.total = bill.subtotal + bill.cgst + bill.sgst + bill.igst;
        updateData.discount = 0;
      }

      await (tx.bill as any).update({ where: { id }, data: updateData });
      await auditLog(tx as any, `DISCOUNT_${parsed.data.action}ED`, bill.orderId, session.userId, session.tenantId, {
        discount: bill.discount, action: parsed.data.action,
      });
      return NextResponse.json({ success: true });
    });
  });
}
