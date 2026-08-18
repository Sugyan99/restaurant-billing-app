import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

const POINTS_PER_RUPEE = 1;          // 1 point per ₹1 spent
const RUPEE_PER_POINTS = 10 / 100;  // ₹0.10 per point (100 pts = ₹10)

function tier(points: number) {
  if (points >= 5000) return { name: "Gold",   min: 5000, color: "#F59E0B" };
  if (points >= 1000) return { name: "Silver", min: 1000, color: "#94A3B8" };
  return                      { name: "Bronze", min: 0,   color: "#92400E" };
}

// GET — search customer by phone or list top customers
export async function GET(req: NextRequest) {
  return safeHandler("loyalty/GET", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;

    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone");

    if (phone) {
      const customer = await withTenant(session.tenantId, session.userId, (tx) => tx.customer.findFirst({
        where: { phone, tenantId: session.tenantId },
        select: { id: true, name: true, phone: true, loyaltyPoints: true, totalSpent: true, totalVisits: true },
      }));
      if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
      return NextResponse.json({ customer: { ...customer, tier: tier(customer.loyaltyPoints), redeemableAmount: parseFloat((customer.loyaltyPoints * RUPEE_PER_POINTS).toFixed(2)) } });
    }

    const customers = await withTenant(session.tenantId, session.userId, (tx) => tx.customer.findMany({
      where: { tenantId: session.tenantId, loyaltyPoints: { gt: 0 } },
      select: { id: true, name: true, phone: true, loyaltyPoints: true, totalSpent: true, totalVisits: true },
      orderBy: { loyaltyPoints: "desc" },
      take: 100,
    }));
    return NextResponse.json({ customers: customers.map(c => ({ ...c, tier: tier(c.loyaltyPoints) })) });
  });
}

// POST — redeem points as discount
export async function POST(req: NextRequest) {
  return safeHandler("loyalty/POST", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER", "CASHIER"]);
    if (isAuthError(session)) return session;

    const { phone, points } = await req.json();
    if (!phone || !points || points <= 0) return NextResponse.json({ error: "Phone and valid points required" }, { status: 400 });

    const result = await withTenant(session.tenantId, session.userId, async (tx) => {
      const customer = await tx.customer.findFirst({ where: { phone, tenantId: session.tenantId } });
      if (!customer) return { notFound: true } as const;
      if (customer.loyaltyPoints < points) return { insufficient: customer.loyaltyPoints } as const;

      const discount = parseFloat((points * RUPEE_PER_POINTS).toFixed(2));
      const updated = await tx.customer.update({
        where: { id: customer.id },
        data: { loyaltyPoints: { decrement: points } },
      });
      return { discount, remainingPoints: updated.loyaltyPoints } as const;
    });

    if ("notFound" in result) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    if ("insufficient" in result) return NextResponse.json({ error: `Only ${result.insufficient} points available` }, { status: 400 });
    return NextResponse.json({ discount: result.discount, remainingPoints: result.remainingPoints, message: `${points} pts redeemed = ₹${result.discount} off` });
  });
}

// PUT — add points manually (e.g. for cash sales or adjustments)
export async function PUT(req: NextRequest) {
  return safeHandler("loyalty/PUT", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;

    const { phone, points, reason } = await req.json();
    if (!phone || !points || points <= 0) return NextResponse.json({ error: "Phone and valid points required" }, { status: 400 });

    const result = await withTenant(session.tenantId, session.userId, async (tx) => {
      const customer = await tx.customer.findFirst({ where: { phone, tenantId: session.tenantId } });
      if (!customer) return { notFound: true } as const;

      const updated = await tx.customer.update({
        where: { id: customer.id },
        data: { loyaltyPoints: { increment: Math.round(points) } },
      });

      await tx.auditLog.create({
        data: {
          tenantId: session.tenantId,
          action: "ADD_LOYALTY_POINTS",
          entity: "Customer",
          entityId: customer.id,
          userId: session.userId,
          meta: { points: Math.round(points), reason: reason ?? "Manual adjustment", newBalance: updated.loyaltyPoints } as never,
        },
      });
      return { loyaltyPoints: updated.loyaltyPoints } as const;
    });

    if ("notFound" in result) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    return NextResponse.json({ loyaltyPoints: result.loyaltyPoints, added: Math.round(points) });
  });
}

export { POINTS_PER_RUPEE };
