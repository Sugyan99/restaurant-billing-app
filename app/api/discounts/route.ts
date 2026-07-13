import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  return safeHandler("discounts/GET", async () => {
  const session = requireAuth(req);
  if (isAuthError(session)) return session;
  const discounts = await prisma.discount.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ discounts });
});
}

export async function POST(req: NextRequest) {
  return safeHandler("discounts/POST", async () => {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;
  const body = await req.json();
  if (!body.name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const value = parseFloat(body.value);
  if (isNaN(value) || value <= 0) return NextResponse.json({ error: "Value must be a positive number" }, { status: 400 });
  if (body.type === "PERCENT" && value > 100) return NextResponse.json({ error: "Percentage cannot exceed 100" }, { status: 400 });
  const discount = await prisma.discount.create({
    data: { id: `disc_${Date.now()}`, name: body.name, type: body.type ?? "PERCENT", value: body.value }
  });
  return NextResponse.json({ discount }, { status: 201 });
});
}
