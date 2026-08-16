import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export const STAFF_PERMISSIONS = [
  "staff.dashboard", "staff.view", "staff.manage", "staff.attendance", "staff.shift",
  "staff.performance", "staff.commission", "staff.login_logs", "staff.activity", "staff.cashier_closing",
] as const;

const DEFAULTS: Record<string, string[]> = {
  OWNER: ["*"],
  MANAGER: [...STAFF_PERMISSIONS],
  CASHIER: ["staff.dashboard", "staff.view", "staff.attendance", "staff.cashier_closing"],
  KITCHEN: ["staff.dashboard", "staff.view", "staff.attendance"],
};

export type StaffSession = { userId: string; tenantId: string; role: string };

export async function requireStaffPermission(req: NextRequest, permission: string): Promise<StaffSession | NextResponse> {
  const base = requireAuth(req);
  if (isAuthError(base)) return base;
  const normalized = permission === "staff.shifts" ? "staff.shift" : permission === "staff.cashier-closing" ? "staff.cashier_closing" : permission;

  const rows = await prisma.$queryRaw<Array<{ role: string; status: string; is_active: boolean }>>`
    select tm.role, tm.status, u."isActive" as is_active
    from public.tenant_memberships tm join public."User" u on u.id=tm.user_id
    where tm.tenant_id=${base.tenantId}::uuid and tm.user_id=${base.userId} limit 1
  `;
  const membership = rows[0];
  if (!membership || membership.status !== "active" || !membership.is_active) {
    return NextResponse.json({ error: "Staff account is inactive or no longer a member" }, { status: 403 });
  }
  const role = membership.role.toUpperCase();
  if (role === "OWNER") return { userId: base.userId, tenantId: base.tenantId, role };

  const settings = await prisma.$queryRaw<Array<{ permissions: unknown }>>`
    select permissions from public."Settings" where tenant_id=${base.tenantId}::uuid limit 1
  `;
  const saved = settings[0]?.permissions;
  const savedRole = saved && typeof saved === "object" && saved !== null && Array.isArray((saved as Record<string, unknown>)[role])
    ? ((saved as Record<string, unknown>)[role] as unknown[]).filter((v): v is string => typeof v === "string") : [];
  const rolePermissions = new Set([...(DEFAULTS[role] ?? []), ...savedRole]);
  if (savedRole.includes("staff") && ["staff.dashboard", "staff.view", "staff.attendance"].includes(normalized)) rolePermissions.add(normalized);

  const overrides = await prisma.$queryRaw<Array<{ permission: string; allowed: boolean }>>`
    select permission,allowed from public.staff_permission_overrides
    where tenant_id=${base.tenantId}::uuid and user_id=${base.userId}
  `;
  const override = overrides.find((x) => x.permission === normalized);
  const allowed = override ? override.allowed : rolePermissions.has("*") || rolePermissions.has(normalized);
  if (!allowed) return NextResponse.json({ error: "You don't have permission to perform this action" }, { status: 403 });
  return { userId: base.userId, tenantId: base.tenantId, role };
}

export function isStaffAuthError(value: StaffSession | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
