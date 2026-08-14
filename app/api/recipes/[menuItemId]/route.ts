import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ menuItemId: string }> }) {
  return safeHandler("recipes/GET", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;
    const { menuItemId } = await params;
    const ingredients = await prisma.recipeIngredient.findMany({
      where: { menuItemId, tenantId: session.tenantId },
      include: { inventoryItem: { select: { id: true, name: true, unit: true, currentStock: true } } },
    });
    return NextResponse.json({ ingredients });
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ menuItemId: string }> }) {
  return safeHandler("recipes/POST", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;
    const { menuItemId } = await params;
    const { inventoryItemId, quantity, unit } = await req.json();
    if (!inventoryItemId || quantity <= 0) return NextResponse.json({ error: "inventoryItemId and quantity required" }, { status: 400 });
    const ingredient = await prisma.recipeIngredient.upsert({
      where: { menuItemId_inventoryItemId: { menuItemId, inventoryItemId } },
      update: { quantity, unit: unit ?? "kg" },
      create: { id: `ri_${Date.now()}`, tenantId: session.tenantId, menuItemId, inventoryItemId, quantity, unit: unit ?? "kg" },
      include: { inventoryItem: { select: { id: true, name: true, unit: true } } },
    });
    return NextResponse.json({ ingredient }, { status: 201 });
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ menuItemId: string }> }) {
  return safeHandler("recipes/DELETE", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;
    const { menuItemId } = await params;
    const inventoryItemId = new URL(req.url).searchParams.get("inventoryItemId");
    if (!inventoryItemId) return NextResponse.json({ error: "inventoryItemId required" }, { status: 400 });
    // Verify ownership before delete
    const existing = await prisma.recipeIngredient.findFirst({
      where: { menuItemId, inventoryItemId, tenantId: session.tenantId },
    });
    if (!existing) return NextResponse.json({ error: "Recipe ingredient not found" }, { status: 404 });
    await prisma.recipeIngredient.delete({ where: { menuItemId_inventoryItemId: { menuItemId, inventoryItemId } } });
    return NextResponse.json({ success: true });
  });
}
