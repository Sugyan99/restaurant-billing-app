import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

// Redeem loyalty points as discount (100 points = ₹10)
export async function POST(req: NextRequest) {
  return safeHandler("loyalty/POST", async () => {
  const session = requireAuth(req, ["OWNER", "MANAGER", "CASHIER"]);
  if (isAuthError(session)) return session;

  const { phone, points } = await req.json();
  if (!phone || !points) return NextResponse.json({ error: "Phone and points required" }, { status: 400 });

  const customer = await prisma.customer.findUnique({ where: { phone } });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  if (customer.loyaltyPoints < points) {
    return NextResponse.json({ error: `Only ${customer.loyaltyPoints} points available` }, { status: 400 });
  }

  const discount = parseFloat(((points / 100) * 10).toFixed(2)); // 100 pts = ₹10

  await prisma.customer.update({
    where: { phone },
    data: { loyaltyPoints: { decrement: points } },
  });

  return NextResponse.json({ discount, remainingPoints: customer.loyaltyPoints - points });
});
}
