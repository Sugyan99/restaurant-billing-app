import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return safeHandler("vendors/[id]/PUT", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;
    const { id } = await params;
    const body = await req.json();
    const vendor = await withTenant(session.tenantId, session.userId, (tx) =>
      tx.vendor.update({
        where: { id },
        data: {
          name: body.name, contact: body.contact, phone: body.phone,
          email: body.email, address: body.address, gstin: body.gstin,
          isActive: body.isActive ?? true,
        },
      })
    );
    return NextResponse.json({ vendor });
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return safeHandler("vendors/[id]/DELETE", async () => {
    const session = requireAuth(req, ["OWNER"]);
    if (isAuthError(session)) return session;
    const { id } = await params;
    await withTenant(session.tenantId, session.userId, (tx) =>
      tx.vendor.delete({ where: { id } })
    );
    return NextResponse.json({ success: true });
  });
}
