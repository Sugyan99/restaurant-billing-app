import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect dashboard routes
  if (!pathname.startsWith("/dashboard")) return NextResponse.next();

  // 1. JWT cookie present (email/password OR Google-bridged users)
  //    Full verification happens in requireAuth on every API call.
  //    Proxy only checks existence to avoid edge/server JWT library mismatch.
  const hasJwt = !!req.cookies.get("token")?.value;
  if (hasJwt) return NextResponse.next();

  // 2. Supabase session cookie (chunked: sb-*-auth-token, sb-*-auth-token.0, etc.)
  const hasSupabase = req.cookies.getAll().some(
    (c) => c.name.startsWith("sb-") && c.name.includes("-auth-token")
  );
  if (hasSupabase) return NextResponse.next();

  // No auth found → login
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
