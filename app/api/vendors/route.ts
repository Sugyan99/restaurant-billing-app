import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  contact: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  gstin: z.string().optional(),
  isActive: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  return safeHandler("vendors/GET", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;
    const vendors = await withTenant(session.tenantId, session.userId, (tx) =>
      tx.vendor.findMany({ where: { tenantId: session.tenantId }, orderBy: { name: "asc" } })
    );
    return NextResponse.json({ vendors });
  });
}

export async function POST(req: NextRequest) {
  return safeHandler("vendors/POST", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    const vendor = await withTenant(session.tenantId, session.userId, (tx) =>
      tx.vendor.create({
        data: { id: `vnd_${Date.now()}`, tenantId: session.tenantId, ...parsed.data },
      })
    );
    return NextResponse.json({ vendor }, { status: 201 });
  });
}
