import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  const session = requireAuth(req);
  if (isAuthError(session)) return session;
  const discounts = await (prisma as any).discount.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ discounts });
}

export async function POST(req: NextRequest) {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;
  const body = await req.json();
  if (!body.name || !body.value) return NextResponse.json({ error: "Name and value required" }, { status: 400 });
  const discount = await (prisma as any).discount.create({
    data: { id: `disc_${Date.now()}`, name: body.name, type: body.type ?? "PERCENT", value: body.value }
  });
  return NextResponse.json({ discount }, { status: 201 });
}
