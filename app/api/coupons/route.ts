import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { z } from "zod";

const schema = z.object({
  code: z.string().min(3).max(20).toUpperCase(),
  description: z.string().optional(),
  type: z.enum(["PERCENT", "FLAT"]),
  value: z.number().positive(),
  minOrder: z.number().min(0).default(0),
  usageLimit: z.number().int().min(0).default(0),
  expiresAt: z.string().optional(),
});

export async function GET(req: NextRequest) {
  return safeHandler("coupons/GET", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    // Validate a specific coupon code
    if (code) {
      const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
      if (!coupon) return NextResponse.json({ error: "Invalid coupon" }, { status: 404 });
      if (!coupon.isActive) return NextResponse.json({ error: "Coupon is inactive" }, { status: 400 });
      if (coupon.expiresAt && coupon.expiresAt < new Date())
        return NextResponse.json({ error: "Coupon expired" }, { status: 400 });
      if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit)
        return NextResponse.json({ error: "Coupon usage limit reached" }, { status: 400 });
      return NextResponse.json({ coupon });
    }

    const coupons = await prisma.coupon.findMany({
      include: { _count: { select: { usages: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ coupons });
  });
}

export async function POST(req: NextRequest) {
  return safeHandler("coupons/POST", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

    const { code, description, type, value, minOrder, usageLimit, expiresAt } = parsed.data;

    if (type === "PERCENT" && value > 100)
      return NextResponse.json({ error: "Percent discount cannot exceed 100%" }, { status: 400 });

    const existing = await prisma.coupon.findUnique({ where: { code } });
    if (existing) return NextResponse.json({ error: "Coupon code already exists" }, { status: 409 });

    const coupon = await prisma.coupon.create({
      data: {
        code, description: description || null, type, value, minOrder, usageLimit,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });
    return NextResponse.json({ coupon }, { status: 201 });
  });
}
