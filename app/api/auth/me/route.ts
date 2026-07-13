import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  return safeHandler("auth/me/GET", async () => {
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
