import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";

// Auth0 callback handler - exchanges a verified Auth0 identity for our app JWT.
export async function POST(req: NextRequest) {
  try {
    const { email, name, sub } = await req.json();
    if (!email || !sub) {
      return NextResponse.json({ error: "Verified email and subject required" }, { status: 400 });
    }

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      const count = await prisma.user.count();
      user = await prisma.user.create({
        data: {
          name: name ?? email.split("@")[0],
          email,
          passwordHash: `auth0:${sub}`,
          role: count === 0 ? "OWNER" : "CASHIER",
          isActive: true,
        },
      });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: "Account is deactivated" }, { status: 403 });
    }

    const membership = await prisma.tenantMembership.findFirst({
      where: { userId: user.id, status: "active" },
      select: { tenantId: true },
      orderBy: { createdAt: "asc" },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Account is not associated with a tenant. Contact your administrator." },
        { status: 403 }
      );
    }

    const token = signToken({
      userId: user.id,
      role: user.role,
      tenantId: membership.tenantId,
    });

    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return response;
  } catch (err) {
    console.error("Auth0 callback error:", err);
    return NextResponse.json({ error: "Auth0 login failed" }, { status: 500 });
  }
}
