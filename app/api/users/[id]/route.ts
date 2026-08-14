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
  salary: z.number().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("users/[id]/PUT", async () => {
    const session = requireAuth(req, ["OWNER"]);
    if (isAuthError(session)) return session;
    const { id } = await params;
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

    // Verify user is a member of this tenant
    const membership = await prisma.tenantMembership.findFirst({
      where: { userId: id, tenantId: session.tenantId },
    });
    if (!membership) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (id === session.userId && parsed.data.isActive === false) {
      return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.password) {
      updateData.passwordHash = await hashPassword(parsed.data.password);
      delete updateData.password;
    }

    // Update role in membership too if changed
    if (parsed.data.role) {
      await prisma.tenantMembership.update({
        where: { id: membership.id },
        data: { role: parsed.data.role },
      });
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, phone: true, isActive: true, salary: true },
    });

    return NextResponse.json({ user });
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("users/[id]/DELETE", async () => {
    const session = requireAuth(req, ["OWNER"]);
    if (isAuthError(session)) return session;
    const { id } = await params;

    if (id === session.userId) return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });

    // Verify user belongs to this tenant
    const membership = await prisma.tenantMembership.findFirst({
      where: { userId: id, tenantId: session.tenantId },
    });
    if (!membership) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Soft delete
    const user = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, name: true, isActive: true },
    });

    return NextResponse.json({ user, message: "User deactivated successfully" });
  });
}
