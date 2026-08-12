import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  return safeHandler("reservations/GET", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);
    const reservations = await withTenant(session.tenantId, session.userId, (tx) =>
      tx.reservation.findMany({
        where: { tenantId: session.tenantId, date: { gte: start, lte: end } },
        include: { table: true },
        orderBy: { date: "asc" },
      })
    );
    return NextResponse.json({ reservations });
  });
}

export async function POST(req: NextRequest) {
  return safeHandler("reservations/POST", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;
    const body = await req.json();
    if (!body.customerName || !body.customerPhone || !body.date) {
      return NextResponse.json({ error: "Name, phone and date are required" }, { status: 400 });
    }
    if (new Date(body.date) < new Date()) {
      return NextResponse.json({ error: "Reservation date cannot be in the past" }, { status: 400 });
    }
    const reservation = await withTenant(session.tenantId, session.userId, (tx) =>
      tx.reservation.create({
        data: {
          id: `res_${Date.now()}`,
          tenantId: session.tenantId,
          customerName: body.customerName,
          customerPhone: body.customerPhone,
          partySize: body.partySize ?? 2,
          date: new Date(body.date),
          tableId: body.tableId || null,
          notes: body.notes ?? null,
          status: "CONFIRMED",
        },
        include: { table: true },
      })
    );
    return NextResponse.json({ reservation }, { status: 201 });
  });
}
