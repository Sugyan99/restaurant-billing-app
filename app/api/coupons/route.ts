import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
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

    const result = await withTenant(session.tenantId, session.userId, async (tx) => {
      if (code) {
        const coupon = await tx.coupon.findFirst({ where: { code: code.toUpperCase(), tenantId: session.tenantId } });
        if (!coupon) return { error: "Invalid coupon", status: 404 } as const;
        if (!coupon.isActive) return { error: "Coupon is inactive", status: 400 } as const;
        if (coupon.expiresAt && coupon.expiresAt < new Date()) return { error: "Coupon expired", status: 400 } as const;
        if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) return { error: "Coupon usage limit reached", status: 400 } as const;
        return { coupon } as const;
      }
      const coupons = await tx.coupon.findMany({
        where: { tenantId: session.tenantId },
        include: { _count: { select: { usages: true } } },
        orderBy: { createdAt: "desc" },
      });
      return { coupons } as const;
    });

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
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

    const result = await withTenant(session.tenantId, session.userId, async (tx) => {
      const existing = await tx.coupon.findFirst({ where: { code, tenantId: session.tenantId } });
      if (existing) return { conflict: true } as const;
      const coupon = await tx.coupon.create({
        data: {
          code, description: description || null, type, value, minOrder, usageLimit,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          tenantId: session.tenantId,
        },
      });
      return { coupon } as const;
    });

    if ("conflict" in result) return NextResponse.json({ error: "Coupon code already exists" }, { status: 409 });
    return NextResponse.json({ coupon: (result as { coupon: unknown }).coupon }, { status: 201 });
  });
}
