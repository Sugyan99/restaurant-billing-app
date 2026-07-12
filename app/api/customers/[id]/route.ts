import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      creditBalance: body.creditBalance,
    },
  });
  return NextResponse.json({ customer });
}
