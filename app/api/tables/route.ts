import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  return safeHandler("tables/GET", async () => {
  const session = requireAuth(req);
  if (isAuthError(session)) return session;

  const tables = await prisma.restaurantTable.findMany({
    orderBy: { number: "asc" },
    include: {
      orders: {
        where: { status: { in: ["PENDING", "PREPARING", "READY"] } },
        include: { items: { include: { menuItem: true } } },
      },
    },
  });

  return NextResponse.json({ tables });
});
}

export async function POST(req: NextRequest) {
  return safeHandler("tables/POST", async () => {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const body = await req.json();
  if (!body.number) {
    return NextResponse.json({ error: "Table number is required" }, { status: 400 });
  }

  const table = await prisma.restaurantTable.create({
    data: { number: String(body.number), capacity: body.capacity ?? 4 },
  });

  return NextResponse.json({ table }, { status: 201 });
});
}
