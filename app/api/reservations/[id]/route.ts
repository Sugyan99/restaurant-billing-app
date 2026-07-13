import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("reservations/[id]/PUT", async () => {
    const session = requireAuth(req);
  if (isAuthError(session)) return session;
  const { id } = await params;
  const body = await req.json();
  const reservation = await prisma.reservation.update({
    where: { id },
    data: { status: body.status, notes: body.notes, tableId: body.tableId },
    include: { table: true },
  });
  return NextResponse.json({ reservation
  });
});
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("reservations/[id]/DELETE", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;
  const { id } = await params;
  await prisma.reservation.delete({ where: { id } });
  return NextResponse.json({ success: true
  });
});
}
