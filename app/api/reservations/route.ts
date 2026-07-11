import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  const session = requireAuth(req);
  if (isAuthError(session)) return session;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(`${date}T23:59:59.999Z`);
  const reservations = await prisma.reservation.findMany({
    where: { date: { gte: start, lte: end } },
    include: { table: true },
    orderBy: { date: "asc" },
  });
  return NextResponse.json({ reservations });
}

export async function POST(req: NextRequest) {
  const session = requireAuth(req);
  if (isAuthError(session)) return session;
  const body = await req.json();
  if (!body.customerName || !body.customerPhone || !body.date) {
    return NextResponse.json({ error: "Name, phone and date are required" }, { status: 400 });
  }
  const reservation = await prisma.reservation.create({
    data: {
      id: `res_${Date.now()}`,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      partySize: body.partySize ?? 2,
      date: new Date(body.date),
      tableId: body.tableId || null,
      notes: body.notes ?? null,
      status: "CONFIRMED",
    },
    include: { table: true },
  });
  return NextResponse.json({ reservation }, { status: 201 });
}
