import { safeHandler } from "@/lib/apiHandler";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  return safeHandler("qr/menu/GET", async () => {
    const [settings, categories] = await Promise.all([
      prisma.settings.findFirst({
        select: { restaurantName: true, address: true, phone: true, receiptHeader: true },
      }),
      prisma.category.findMany({
        include: {
          items: {
            where: { isAvailable: true },
            orderBy: { name: "asc" },
            select: {
              id: true, name: true, description: true, price: true,
              isVeg: true, imageUrl: true, taxRate: true,
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    const filtered = categories.filter((c) => c.items.length > 0);
    return NextResponse.json({ settings, categories: filtered });
  });
}
