import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { createServerClient } from "@supabase/ssr";

// Edge-compatible JWT verification (jose, not jsonwebtoken)
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "fallback-secret-change-in-production"
);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isOnDashboard = pathname.startsWith("/dashboard");
  const isOnLogin = pathname === "/login";

  if (!isOnDashboard && !isOnLogin) return NextResponse.next();

  // --- Check JWT cookie (email/password auth) ---
  const jwtToken = req.cookies.get("token")?.value;
  let jwtValid = false;
  if (jwtToken) {
    try {
      await jwtVerify(jwtToken, JWT_SECRET);
      jwtValid = true;
    } catch {
      // expired/invalid
    }
  }

  // --- Check Supabase session (Google OAuth) ---
  let supabaseResponse = NextResponse.next({ request: req });
  let supabaseUser = false;

  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          cookies: {
            getAll() {
              return req.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value }) =>
                req.cookies.set(name, value)
              );
              supabaseResponse = NextResponse.next({ request: req });
              cookiesToSet.forEach(({ name, value, options }) =>
                supabaseResponse.cookies.set(name, value, options)
              );
            },
          },
        }
      );
      const { data } = await supabase.auth.getUser();
      supabaseUser = !!data.user;
    } catch {
      // Supabase not configured — skip
    }
  }

  const isAuthenticated = jwtValid || supabaseUser;

  if (isOnDashboard && !isAuthenticated) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    if (jwtToken && !jwtValid) {
      res.cookies.set("token", "", { maxAge: 0, path: "/" });
    }
    return res;
  }

  if (isOnLogin && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard/home", req.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
