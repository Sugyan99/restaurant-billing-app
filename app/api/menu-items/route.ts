import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { z } from "zod";

const menuItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  isVeg: z.boolean().optional(),
  categoryId: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const session = requireAuth(req);
  if (isAuthError(session)) return session;

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");
  const onlyAvailable = searchParams.get("available") === "true";

  const items = await prisma.menuItem.findMany({
    where: {
      ...(categoryId ? { categoryId } : {}),
      ...(onlyAvailable ? { isAvailable: true } : {}),
    },
    include: { category: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const body = await req.json();
  const parsed = menuItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid item data" },
      { status: 400 }
    );
  }

  const item = await prisma.menuItem.create({ data: parsed.data });
  return NextResponse.json({ item }, { status: 201 });
}
