import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { safeHandler } from "@/lib/apiHandler";

// Default permissions - what each role can access
export const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  OWNER: ["*"], // all
  MANAGER: ["home","tables","orders","bills","menu","inventory","customers","expenses","day-close","reports","gst-report","staff-report","pnl","reservations","discounts","qr","import","stock-ledger"],
  CASHIER: ["home","tables","orders","bills","customers","reservations"],
  KITCHEN: ["orders"],
};

export async function GET(req: NextRequest) {
  return safeHandler("permissions/GET", async () => {
    const session = requireAuth(req, ["OWNER"]);
    if (isAuthError(session)) return session;
    const settings = await prisma.settings.findFirst();
    const saved = (settings?.permissions as Record<string, string[]> | null) ?? {};
    const merged: Record<string, string[]> = {};
    for (const role of ["OWNER","MANAGER","CASHIER","KITCHEN"]) {
      merged[role] = saved[role] ?? DEFAULT_PERMISSIONS[role];
    }
    return NextResponse.json({ permissions: merged, defaults: DEFAULT_PERMISSIONS });
  });
}

export async function PUT(req: NextRequest) {
  return safeHandler("permissions/PUT", async () => {
    const session = requireAuth(req, ["OWNER"]);
    if (isAuthError(session)) return session;
    const { permissions } = await req.json();
    // OWNER always gets all — prevent lockout
    permissions.OWNER = ["*"];
    let settings = await prisma.settings.findFirst();
    if (!settings) settings = await prisma.settings.create({ data: {} });
    await prisma.settings.update({ where: { id: settings.id }, data: { permissions } });
    return NextResponse.json({ permissions });
  });
}
