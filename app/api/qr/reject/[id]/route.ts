import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("qr/reject/POST", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER", "CASHIER"]);
    if (isAuthError(session)) return session;

    const { id } = await params;

    const qrOrder = await prisma.qrOrder.findFirst({ where: { id, tenantId: session.tenantId } });
    if (!qrOrder) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (qrOrder.status !== "PENDING") {
      return NextResponse.json({ error: "Already processed" }, { status: 409 });
    }

    await prisma.qrOrder.update({ where: { id }, data: { status: "REJECTED" } });

    return NextResponse.json({ success: true });
  });
}
