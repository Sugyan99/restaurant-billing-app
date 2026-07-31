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

    // Find or create User in existing DB so requireAuth works everywhere
    let dbUser = await prisma.user.findUnique({ where: { email: user.email } });

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          email: user.email,
          name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email.split("@")[0],
          passwordHash: "", // Google users have no password
          role: "OWNER",
          isActive: true,
        },
      });
    } else if (!dbUser.isActive) {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }

    // Sign JWT exactly like email/password login does
    const jwt = signToken({ userId: dbUser.id, role: dbUser.role as "OWNER" | "MANAGER" | "CASHIER" | "KITCHEN" });

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
