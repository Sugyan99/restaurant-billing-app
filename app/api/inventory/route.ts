import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  unit: z.string().default("kg"),
  currentStock: z.number().min(0),
  minStock: z.number().min(0),
  costPerUnit: z.number().min(0),
});

export async function GET(req: NextRequest) {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const items = await prisma.inventoryItem.findMany({ orderBy: { name: "asc" } });
  const lowStock = items.filter((i: any) => i.currentStock <= i.minStock);
  return NextResponse.json({ items, lowStock });
}

export async function POST(req: NextRequest) {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const item = await prisma.inventoryItem.create({ data: { ...parsed.data, id: `inv_${Date.now()}` } });
  return NextResponse.json({ item }, { status: 201 });
}
