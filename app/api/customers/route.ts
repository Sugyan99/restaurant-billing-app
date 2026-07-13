import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

  if (phone) {
    const customer = await prisma.customer.findUnique({ where: { phone } });
    return NextResponse.json({ customer });
  }

  const customers = await prisma.customer.findMany({
    where: search ? {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ],
    } : {},
    orderBy: { totalSpent: "desc" },
    take: 50,
  });

  return NextResponse.json({ customers });
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

  const existing = await prisma.customer.findUnique({ where: { phone: parsed.data.phone } });
  if (existing) {
    return NextResponse.json({ customer: existing, message: "Customer already exists" });
  }

  const customer = await prisma.customer.create({
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
    },
  });

  return NextResponse.json({ customer }, { status: 201 });
});
}
