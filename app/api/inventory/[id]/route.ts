import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const { id } = await params;
  const body = await req.json();

  const item = await prisma.inventoryItem.update({
    where: { id },
    data: {
      name: body.name,
      unit: body.unit,
      currentStock: body.currentStock,
      minStock: body.minStock,
      costPerUnit: body.costPerUnit,
      updatedAt: new Date(),
    },
  });
  return NextResponse.json({ item });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = requireAuth(req, ["OWNER"]);
  if (isAuthError(session)) return session;

  const { id } = await params;
  await prisma.inventoryItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
