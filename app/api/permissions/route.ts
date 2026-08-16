import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { safeHandler } from "@/lib/apiHandler";

export const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  OWNER: ["*"],
  MANAGER: ["home","tables","orders","bills","menu","inventory","customers","expenses","day-close","reports","gst-report","staff-report","pnl","reservations","discounts","qr","import","stock-ledger"],
  CASHIER: ["home","tables","orders","bills","customers","reservations"],
  KITCHEN: ["orders"],
};

const ROLES = ["OWNER", "MANAGER", "CASHIER", "KITCHEN"] as const;

async function getEffectivePages(tenantId: string, userId: string, role: string) {
  const settings = await prisma.settings.findFirst({ where: { tenantId } });
  const saved = (settings?.permissions as Record<string, string[]> | null) ?? {};
  const rolePages = new Set<string>(saved[role] ?? DEFAULT_PERMISSIONS[role] ?? []);

  if (role === "OWNER") return ["*"];

  const overrides = await prisma.$queryRaw<Array<{ permission: string; allowed: boolean }>>`
    select permission, allowed
    from public.staff_permission_overrides
    where tenant_id=${tenantId}::uuid and user_id=${userId}
  `;

  for (const override of overrides) {
    // staff.* overrides are enforced by staffAuth.ts for API capabilities.
    // Plain page IDs control dashboard visibility and direct-page navigation.
    if (override.permission.startsWith("staff.")) continue;
    if (override.permission === "*") {
      if (override.allowed) return ["*"];
      rolePages.clear();
      continue;
    }
    if (override.allowed) rolePages.add(override.permission);
    else rolePages.delete(override.permission);
  }

  return [...rolePages];
}

export async function GET(req: NextRequest) {
  return safeHandler("permissions/GET", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;

    // Never trust a role embedded in a session/JWT for authorization. Resolve
    // the active role from the tenant membership and active User row.
    const membership = await prisma.$queryRaw<Array<{ role: string; status: string; is_active: boolean }>>`
      select tm.role, tm.status, u."isActive" as is_active
      from public.tenant_memberships tm
      join public."User" u on u.id=tm.user_id
      where tm.tenant_id=${session.tenantId}::uuid and tm.user_id=${session.userId}
      limit 1
    `;
    const member = membership[0];
    if (!member || member.status !== "active" || !member.is_active) {
      return NextResponse.json({ error: "Staff account is inactive or no longer a member" }, { status: 403 });
    }

    const role = member.role.toUpperCase();
    const effective = await getEffectivePages(session.tenantId, session.userId, role);

    // Non-owners only receive their own effective permissions. This prevents
    // the client from learning or rendering another role's permission matrix.
    if (role !== "OWNER") {
      return NextResponse.json({
        permissions: { [role]: effective },
        effectivePermissions: effective,
        role,
      });
    }

    const settings = await prisma.settings.findFirst({ where: { tenantId: session.tenantId } });
    const saved = (settings?.permissions as Record<string, string[]> | null) ?? {};
    const merged: Record<string, string[]> = {};
    for (const r of ROLES) merged[r] = r === "OWNER" ? ["*"] : (saved[r] ?? DEFAULT_PERMISSIONS[r]);

    return NextResponse.json({
      permissions: merged,
      effectivePermissions: ["*"],
      role,
      defaults: DEFAULT_PERMISSIONS,
    });
  });
}

export async function PUT(req: NextRequest) {
  return safeHandler("permissions/PUT", async () => {
    const session = requireAuth(req, ["OWNER"]);
    if (isAuthError(session)) return session;
    const { permissions } = await req.json();
    if (!permissions || typeof permissions !== "object") {
      return NextResponse.json({ error: "Invalid permissions payload" }, { status: 400 });
    }
    permissions.OWNER = ["*"];
    let settings = await prisma.settings.findFirst({ where: { tenantId: session.tenantId } });
    if (!settings) settings = await prisma.settings.create({ data: { tenantId: session.tenantId } });
    await prisma.settings.update({ where: { id: settings.id }, data: { permissions } });
    return NextResponse.json({ permissions });
  });
}
