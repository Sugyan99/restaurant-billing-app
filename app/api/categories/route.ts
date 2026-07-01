import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { z } from "zod";

const categorySchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().optional(),
});

export async function GET(req: NextRequest) {
  const session = requireAuth(req);
  if (isAuthError(session)) return session;

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { items: true },
  });

  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  // Only owner/manager can change the menu structure
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const body = await req.json();
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Category name is required" }, { status: 400 });
  }

  try {
    const category = await prisma.category.create({ data: parsed.data });
    return NextResponse.json({ category }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "A category with this name already exists" },
      { status: 409 }
    );
  }
}
