import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("coupons/[id]/PUT", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;
    const { id } = await params;
    const body = await req.json();

    const result = await withTenant(session.tenantId, session.userId, async (tx) => {
      const existing = await tx.coupon.findFirst({ where: { id, tenantId: session.tenantId } });
      if (!existing) return { notFound: true } as const;
      const coupon = await tx.coupon.update({ where: { id }, data: { isActive: body.isActive ?? true } });
      return { coupon } as const;
    });

    if ("notFound" in result) return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    return NextResponse.json({ coupon: (result as { coupon: unknown }).coupon });
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("coupons/[id]/DELETE", async () => {
    const session = requireAuth(req, ["OWNER"]);
    if (isAuthError(session)) return session;
    const { id } = await params;

    const result = await withTenant(session.tenantId, session.userId, async (tx) => {
      const existing = await tx.coupon.findFirst({ where: { id, tenantId: session.tenantId } });
      if (!existing) return { notFound: true } as const;
      await tx.coupon.delete({ where: { id } });
      return { success: true } as const;
    });

    if ("notFound" in result) return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  });
}
