import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

export async function proxy(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/dashboard")) return NextResponse.next();

  const token = req.cookies.get("token")?.value;
  if (!token) return NextResponse.redirect(new URL("/login", req.url));

  const secret = process.env.JWT_SECRET;
  if (!secret) return NextResponse.redirect(new URL("/login", req.url));

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
    });
    if (typeof payload.userId !== "string" || typeof payload.tenantId !== "string" || typeof payload.role !== "string") {
      throw new Error("Invalid session claims");
    }
    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL("/login", req.url));
    response.cookies.delete("token");
    return response;
  }
}

export const config = { matcher: ["/dashboard/:path*"] };
