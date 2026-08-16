import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, signToken } from "@/lib/auth";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(1024),
});

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}

async function logLogin(req: NextRequest, email: string, success: boolean, userId?: string, tenantId?: string, failureReason?: string) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip");
  const userAgent = req.headers.get("user-agent");
  await prisma.$executeRaw`
    insert into public.staff_login_logs(tenant_id,user_id,email,success,ip_address,user_agent,failure_reason)
    values (${tenantId ? tenantId : null}::uuid,${userId ?? null},${email},${success},${ip ?? null},${userAgent ?? null},${failureReason ?? null})
  `;
}

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Invalid request" }, { status: 403, headers: { "Cache-Control": "no-store" } });
    if (req.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
      return NextResponse.json({ error: "Invalid request" }, { status: 415, headers: { "Cache-Control": "no-store" } });
    }

    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > 32_768) return NextResponse.json({ error: "Invalid request" }, { status: 413, headers: { "Cache-Control": "no-store" } });

    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid email or password" }, { status: 400, headers: { "Cache-Control": "no-store" } });

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      await logLogin(req, email, false, user?.id, undefined, "invalid_credentials");
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      const membership = await prisma.tenantMembership.findFirst({ where: { userId: user.id, status: "active" }, select: { tenantId: true }, orderBy: { createdAt: "asc" } });
      await logLogin(req, email, false, user.id, membership?.tenantId, "invalid_credentials");
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }

    const membership = await prisma.tenantMembership.findFirst({
      where: { userId: user.id, status: "active" },
      select: { tenantId: true },
      orderBy: { createdAt: "asc" },
    });
    if (!membership) {
      await logLogin(req, email, false, user.id, undefined, "invalid_credentials");
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }

    const token = signToken({ userId: user.id, role: user.role, tenantId: membership.tenantId });
    await logLogin(req, email, true, user.id, membership.tenantId);

    const response = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return response;
  } catch (err) {
    logger.error("auth/login", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
