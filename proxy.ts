import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// jose is used instead of jsonwebtoken because Next.js Edge Runtime
// does not support Node.js crypto — jose is fully Web Crypto compatible.

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "fallback-secret-change-in-production"
);

export async function proxy(req: NextRequest) {
  const isOnDashboard = req.nextUrl.pathname.startsWith("/dashboard");
  if (!isOnDashboard) return NextResponse.next();

  const token = req.cookies.get("token")?.value;

  // No cookie → redirect to login
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Verify JWT signature + expiry
  try {
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    // Token expired or tampered — clear cookie + redirect
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.set("token", "", { maxAge: 0, path: "/" });
    return res;
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
