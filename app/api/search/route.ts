import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  return safeHandler("search/GET", async () => {
  const session = requireAuth(req);
  if (isAuthError(session)) return session;

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const [customers, items, orders] = await Promise.all([
    prisma.customer.findMany({
      where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] },
      take: 5, select: { id: true, name: true, phone: true },
    }),
    prisma.menuItem.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      take: 5, select: { id: true, name: true, price: true, isAvailable: true },
    }),
    prisma.order.findMany({
      where: { OR: [{ customerName: { contains: q, mode: "insensitive" } }, { customerPhone: { contains: q } }] },
      take: 5,
      select: { id: true, orderNumber: true, status: true, customerName: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    results: [
      ...customers.map(c => ({ type: "customer", label: c.name, sub: c.phone, id: c.id })),
      ...items.map(i => ({ type: "menu", label: i.name, sub: `₹${i.price} · ${i.isAvailable ? "Available" : "Unavailable"}`, id: i.id })),
      ...orders.map(o => ({ type: "order", label: `Order #${o.orderNumber} — ${o.customerName ?? "Guest"}`, sub: o.status, id: o.id })),
    ],
  });
});
}
