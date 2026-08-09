import { safeHandler } from "@/lib/apiHandler";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";

// Cache QR menu for 60 seconds — menu rarely changes mid-service
// and this endpoint is hit on every QR scan. Revalidated on menu item updates.
const getQrMenu = unstable_cache(
  async () => {
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
    return { settings, categories: categories.filter((c) => c.items.length > 0) };
  },
  ["qr-menu"],
  { revalidate: 60 }
);

export async function GET() {
  return safeHandler("qr/menu/GET", async () => {
    const data = await getQrMenu();
    return NextResponse.json(data);
  });
}
