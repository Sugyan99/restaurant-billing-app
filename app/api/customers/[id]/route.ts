import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("customers/[id]/GET", async () => {
    const session = requireAuth(req);
  if (isAuthError(session)) return session;
  const { id } = await params;

  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orders = await prisma.order.findMany({
    where: { customerPhone: customer.phone },
    include: {
      items: { include: { menuItem: { select: { name: true } } } },
      bill: { select: { total: true, paymentStatus: true, paymentMode: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ customer, orders
  });
});
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("customers/[id]/PUT", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;
  const { id } = await params;
  const body = await req.json();
  const customer = await prisma.customer.update({
    where: { id },
    data: {
      name: body.name,
      email: body.email || null,
      address: body.address || null,
      notes: body.notes || null,
      creditBalance: Math.max(0, body.creditBalance ?? 0),
    },
  });
  return NextResponse.json({ customer
  });
});
}
