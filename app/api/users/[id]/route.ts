import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { hashPassword } from "@/lib/auth";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(["OWNER", "MANAGER", "CASHIER", "KITCHEN"]).optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

export async function PUT(
  req: NextRequest,
  {
  return safeHandler("users/[id]/PUT", async () => { params }: { params: Promise<{ id: string }> }
) {
  const session = requireAuth(req, ["OWNER"]);
  if (isAuthError(session)) return session;

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  // Prevent owner from deactivating themselves
  if (id === session.userId && parsed.data.isActive === false) {
    return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.password) {
    updateData.passwordHash = await hashPassword(parsed.data.password);
    delete updateData.password;
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, email: true, role: true, phone: true, isActive: true },
  });

  return NextResponse.json({ user });
});
}

export async function DELETE(
  req: NextRequest,
  {
  return safeHandler("users/[id]/DELETE", async () => { params }: { params: Promise<{ id: string }> }
) {
  const session = requireAuth(req, ["OWNER"]);
  if (isAuthError(session)) return session;

  const { id } = await params;

  if (id === session.userId) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  // Soft delete — deactivate instead of hard delete to preserve order history
  const user = await prisma.user.update({
    where: { id },
    data: { isActive: false },
    select: { id: true, name: true, isActive: true },
  });

  return NextResponse.json({ user, message: "User deactivated successfully" });
});
}
