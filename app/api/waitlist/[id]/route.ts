import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("waitlist/[id]/PUT", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;
    const { id } = await params;
    const body = await req.json();
    const entry = await prisma.waitlist.update({
      where: { id },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.tableId !== undefined && { tableId: body.tableId }),
        ...(body.estimatedWait !== undefined && { estimatedWait: body.estimatedWait }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
    });
    return NextResponse.json({ entry });
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("waitlist/[id]/DELETE", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;
    const { id } = await params;
    await prisma.waitlist.delete({ where: { id } });
    return NextResponse.json({ success: true });
  });
}
