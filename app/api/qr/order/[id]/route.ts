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
      select: {
        id: true,
        tableNumber: true,
        customerName: true,
        items: true,
        notes: true,
        status: true,
        orderId: true,
        createdAt: true,
        updatedAt: true,
        // Never expose customerPhone from this public endpoint.
        feedback: { select: { rating: true } },
      },
    });
    if (!qrOrder) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // If approved, also get live Order status
    let orderStatus: string | null = null;
    if (qrOrder.orderId) {
      const order = await prisma.order.findUnique({
        where: { id: qrOrder.orderId },
        select: { status: true },
      });
      orderStatus = order?.status ?? null;
    }

    return NextResponse.json({ qrOrder, orderStatus });
  });
}
