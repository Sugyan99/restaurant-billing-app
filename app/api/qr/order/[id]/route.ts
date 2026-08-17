import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("qr/order/[id]/GET", async () => {
    const { id } = await params;
    const qrOrder = await prisma.qrOrder.findUnique({
      where: { id },
      include: { feedback: { select: { rating: true } } },
    });
    if (!qrOrder) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // If approved, also get live Order status
    let orderStatus: string | null = null;
    if (qrOrder.orderId) {
      const order = await prisma.order.findUnique({
        where: { id: qrOrder.orderId },
        select: { status: true, orderNumber: true },
      });
      orderStatus = order?.status ?? null;
    }

    return NextResponse.json({ qrOrder, orderStatus });
  });
}
