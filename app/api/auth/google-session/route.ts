import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  return safeHandler("auth/google-session/POST", async () => {
    const { accessToken } = await req.json();
    if (!accessToken) {
      return NextResponse.json({ error: "Missing access token" }, { status: 400 });
    }

    // Verify token with Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (error || !user || !user.email) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Look up existing account — we do NOT auto-create users via OAuth.
    // A restaurant owner must first add the staff account via /api/auth/register.
    // This prevents any Google account from self-registering as OWNER.
    const dbUser = await prisma.user.findUnique({ where: { email: user.email } });

    if (!dbUser) {
      return NextResponse.json(
        { error: "No account found for this Google address. Ask your restaurant owner to add you first." },
        { status: 403 }
      );
    }

    if (!dbUser.isActive) {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }

    // Resolve tenant membership
    const membership = await prisma.tenantMembership.findFirst({
      where: { userId: dbUser.id, status: "active" },
      select: { tenantId: true },
      orderBy: { createdAt: "asc" },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Account is not associated with any tenant. Contact your administrator." },
        { status: 403 }
      );
    }

    const jwt = signToken({
      userId: dbUser.id,
      role: dbUser.role as "OWNER" | "MANAGER" | "CASHIER" | "KITCHEN",
      tenantId: membership.tenantId,
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set("token", jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });
    return response;
  });
}
