import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/qr/menu?tid=TENANT_ID
// Public endpoint — no auth required. Scoped by tenantId query param.
export async function GET(req: NextRequest) {
  return safeHandler("qr/menu/GET", async () => {
    const tid = new URL(req.url).searchParams.get("tid");

    // Resolve tenant: by ID param, or fall back to the single configured tenant
    const tenant = tid
      ? await prisma.tenant.findUnique({ where: { id: tid } })
      : await prisma.tenant.findFirst();

    if (!tenant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

    const [settings, categories] = await Promise.all([
      prisma.settings.findFirst({
        where: { tenantId: tenant.id },
        select: { restaurantName: true, address: true, phone: true, receiptHeader: true },
      }),
      prisma.category.findMany({
        where: { tenantId: tenant.id },
        include: {
          items: {
            where: { tenantId: tenant.id, isAvailable: true },
            orderBy: { name: "asc" },
            select: { id: true, name: true, description: true, price: true, isVeg: true, imageUrl: true, taxRate: true },
          },
        },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    return NextResponse.json({
      settings,
      categories: categories.filter(c => c.items.length > 0),
      tenantId: tenant.id,
    });
  });
}
