import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  return safeHandler("waitlist/GET", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;
    const waitlist = await prisma.waitlist.findMany({
      where: { status: "WAITING" },
      include: { table: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ waitlist });
  });
}

export async function POST(req: NextRequest) {
  return safeHandler("waitlist/POST", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;
    const body = await req.json();
    if (!body.customerName) {
      return NextResponse.json({ error: "Customer name required" }, { status: 400 });
    }
    const entry = await prisma.waitlist.create({
      data: {
        customerName: body.customerName,
        customerPhone: body.customerPhone ?? "",
        partySize: body.partySize ?? 2,
        estimatedWait: body.estimatedWait ?? 15,
        notes: body.notes ?? null,
      },
    });
    return NextResponse.json({ entry }, { status: 201 });
  });
}
