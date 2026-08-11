import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { z } from "zod";

const schema = z.object({
  customerPhone: z.string().optional(),
  customerName: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
  category: z.enum(["FOOD", "SERVICE", "AMBIENCE", "VALUE", "OVERALL"]).default("OVERALL"),
  orderId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  return safeHandler("feedback/GET", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const rating = searchParams.get("rating");

    const feedback = await prisma.customerFeedback.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(rating ? { rating: parseInt(rating) } : {}),
      },
      include: { customer: { select: { name: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const stats = await prisma.customerFeedback.aggregate({
      _avg: { rating: true },
      _count: { id: true },
    });

    const dist = await prisma.customerFeedback.groupBy({
      by: ["rating"],
      _count: { id: true },
      orderBy: { rating: "desc" },
    });

    return NextResponse.json({ feedback, stats, distribution: dist });
  });
}

export async function POST(req: NextRequest) {
  return safeHandler("feedback/POST", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

    const { customerPhone, customerName, rating, comment, category, orderId } = parsed.data;

    let customerId: string | null = null;
    if (customerPhone) {
      const c = await prisma.customer.findFirst({ where: { phone: customerPhone, tenantId: session.tenantId } });
      if (c) customerId = c.id;
    }

    const feedback = await prisma.customerFeedback.create({
      data: {
        customerId,
        customerPhone: customerPhone || null,
        customerName: customerName || null,
        rating, comment: comment || null, category,
        orderId: orderId || null,
      },
    });
    return NextResponse.json({ feedback }, { status: 201 });
  });
}
