import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  return safeHandler("auth/me/GET", async () => {
    // 1. Check Supabase session (Google OAuth users)
    const supabase = await createClient();
    const { data: { user: supabaseUser } } = await supabase.auth.getUser();

    if (supabaseUser) {
      // Fetch profile from profiles table
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, name, email, role, avatar_url")
        .eq("id", supabaseUser.id)
        .single();

      if (profile) {
        return NextResponse.json({
          user: {
            id: profile.id,
            name: profile.name,
            email: profile.email,
            role: profile.role ?? "OWNER",
          },
        });
      }

      // Fallback if profile row not yet created
      return NextResponse.json({
        user: {
          id: supabaseUser.id,
          name: supabaseUser.user_metadata?.full_name ?? supabaseUser.email?.split("@")[0] ?? "User",
          email: supabaseUser.email,
          role: "OWNER",
        },
      });
    }

    // 2. Check JWT cookie (email/password users)
    const token = req.cookies.get("token")?.value;
    const session = token ? verifyToken(token) : null;

    if (!session) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    return NextResponse.json({ user });
  });
}
