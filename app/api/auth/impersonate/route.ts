import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { logger } from "@/lib/logger";

const IMPERSONATION_SECRET = process.env.IMPERSONATION_SECRET;

export async function GET(req: NextRequest) {
  if (!IMPERSONATION_SECRET) {
    return NextResponse.json({ error: "Impersonation not configured" }, { status: 503 });
  }
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  let payload: { tenantId: string; userId: string; adminEmail: string; purpose: string };
  try {
    const secret = new TextEncoder().encode(IMPERSONATION_SECRET);
    const { payload: p } = await jwtVerify(token, secret);
    payload = p as unknown as typeof payload;
    if (payload.purpose !== "impersonation") throw new Error("bad purpose");
  } catch {
    return NextResponse.json({ error: "Invalid or expired impersonation link" }, { status: 401 });
  }

  const membership = await prisma.tenantMembership.findFirst({
    where: { userId: payload.userId, tenantId: payload.tenantId, status: "active" },
    include: { user: true },
  });
  if (!membership || !membership.user.isActive) {
    return NextResponse.json({ error: "User not found or inactive in this tenant" }, { status: 404 });
  }

  const sessionToken = signToken({
    userId: membership.user.id,
    role: membership.user.role,
    tenantId: payload.tenantId,
  });

  try {
    await prisma.$executeRaw`
      insert into public.staff_login_logs(tenant_id,user_id,email,success,failure_reason)
      values (${payload.tenantId}::uuid, ${membership.user.id}, ${membership.user.email}, true, ${"impersonation:" + payload.adminEmail})
    `;
  } catch (err) {
    logger.error("auth/impersonate log", err);
  }

  const response = NextResponse.redirect(new URL("/", req.url));
  response.cookies.set("token", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 2, // impersonated sessions expire in 2h regardless of normal 7d
    path: "/",
  });
  return response;
}
