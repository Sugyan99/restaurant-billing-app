import { NextRequest, NextResponse } from "next/server";
import { verifyToken, JwtPayload } from "@/lib/auth";

/**
 * Checks the request's cookie for a valid session.
 * If `allowedRoles` is given, also checks the user's role is in that list.
 * Returns the session payload if valid, or a NextResponse (error) to return immediately.
 */
export function requireAuth(
  req: NextRequest,
  allowedRoles?: JwtPayload["role"][]
): JwtPayload | NextResponse {
  const token = req.cookies.get("token")?.value;
  const session = token ? verifyToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return NextResponse.json(
      { error: "You don't have permission to do this" },
      { status: 403 }
    );
  }

  return session;
}

/** Type guard to check if requireAuth returned an error response vs a session */
export function isAuthError(
  result: JwtPayload | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
