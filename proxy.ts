import { NextRequest, NextResponse } from "next/server";

// Note: Full JWT verification (with the secret) happens in API routes / server
// components, since the `jsonwebtoken` library needs Node's crypto module which
// isn't available in Next.js Edge Middleware. Here we just check the cookie
// exists, as a fast first line of defense before the page even loads.
export function proxy(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const isOnDashboard = req.nextUrl.pathname.startsWith("/dashboard");

  if (isOnDashboard && !token) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
