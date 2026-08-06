import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  qrOrderId: z.string().min(1),
  rating:    z.number().int().min(1).max(5),
  comment:   z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  return safeHandler("qr/feedback/POST", async () => {
    const body   = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const { qrOrderId, rating, comment } = parsed.data;

    // Verify order exists and is approved
    const qrOrder = await prisma.qrOrder.findUnique({ where: { id: qrOrderId } });
    if (!qrOrder) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (qrOrder.feedback) return NextResponse.json({ error: "Feedback already submitted" }, { status: 409 });

    const feedback = await prisma.qrFeedback.create({
      data: { qrOrderId, rating, comment: comment ?? null },
    });

    return NextResponse.json({ feedback }, { status: 201 });
  });
}
