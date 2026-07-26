import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";

// Auth0 callback handler - exchanges Auth0 session for our app JWT
// Auth0 integration sets: AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET
export async function POST(req: NextRequest) {
  try {
    const { email, name, sub } = await req.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    // Find existing user by email
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // First Auth0 login - check if any users exist
      const count = await prisma.user.count();
      // Auto-create as OWNER if first user, else CASHIER (owner can upgrade role)
      user = await prisma.user.create({
        data: {
          name: name ?? email.split("@")[0],
          email,
          passwordHash: `auth0:${sub}`, // Auth0 users have no local password
          role: count === 0 ? "OWNER" : "CASHIER",
          isActive: true,
        },
      });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: "Account is deactivated" }, { status: 403 });
    }

    const token = signToken({ userId: user.id, role: user.role });
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
