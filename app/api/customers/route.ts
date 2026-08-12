import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { z } from "zod";

const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
});

export async function GET(req: NextRequest) {
  return safeHandler("customers/GET", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;

    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone");
    const search = searchParams.get("search");

    const result = await withTenant(session.tenantId, session.userId, async (tx) => {
      if (phone) {
        const customer = await tx.customer.findFirst({ where: { phone, tenantId: session.tenantId } });
        return { customer };
      }
      const customers = await tx.customer.findMany({
        where: {
          tenantId: session.tenantId,
          ...(search ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
            ],
          } : {}),
        },
        orderBy: { totalSpent: "desc" },
        take: 50,
      });
      return { customers };
    });

    return NextResponse.json(result);
  });
}

export async function POST(req: NextRequest) {
  return safeHandler("customers/POST", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;

    const body = await req.json();
    const parsed = customerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const result = await withTenant(session.tenantId, session.userId, async (tx) => {
      const existing = await tx.customer.findFirst({ where: { phone: parsed.data.phone, tenantId: session.tenantId } });
      if (existing) return { customer: existing, exists: true };
      const customer = await tx.customer.create({
        data: {
          name: parsed.data.name,
          phone: parsed.data.phone,
          email: parsed.data.email || null,
          address: parsed.data.address || null,
          tenantId: session.tenantId,
        },
      });
      return { customer, exists: false };
    });

    if (result.exists) {
      return NextResponse.json({ customer: result.customer, message: "Customer already exists" });
    }
    return NextResponse.json({ customer: result.customer }, { status: 201 });
  });
}
