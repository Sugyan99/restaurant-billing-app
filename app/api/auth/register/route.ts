import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyToken } from "@/lib/auth";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["OWNER", "MANAGER", "CASHIER", "KITCHEN"]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { name, email, password, role } = parsed.data;

    // Pre-hash outside transaction (bcrypt is slow; transactions should be short)
    const passwordHash = await hashPassword(password);

    // Atomic first-user bootstrap — count() + create() in one transaction
    // prevents a race condition where two concurrent requests both see count=0
    // and both self-register as OWNER.
    try {
      const owner = await prisma.$transaction(async (tx) => {
        const count = await tx.user.count();
        if (count > 0) {
          throw Object.assign(new Error("NOT_FIRST"), { code: "NOT_FIRST" });
        }
        const newOwner = await tx.user.create({ data: { name, email, passwordHash, role: "OWNER" } });

        // Bind owner to the default tenant (created in Phase 2)
        const defaultTenant = await tx.tenant.findFirst({ where: { slug: "default" } });
        if (defaultTenant) {
          await tx.tenantMembership.upsert({
            where: { tenantId_userId: { tenantId: defaultTenant.id, userId: newOwner.id } },
            update: {},
            create: {
              tenantId: defaultTenant.id,
              userId: newOwner.id,
              role: "owner",
              status: "active",
              joinedAt: new Date(),
            },
          });
        }
        return newOwner;
      });
      return NextResponse.json(
        { user: { id: owner.id, name: owner.name, email: owner.email, role: owner.role } },
        { status: 201 }
      );
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "NOT_FIRST") throw e;
    }

    // Once an OWNER exists, only a logged-in OWNER can add new staff accounts
    const token = req.cookies.get("token")?.value;
    const session = token ? verifyToken(token) : null;

    if (!session || session.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only the restaurant owner can add new staff accounts" },
        { status: 403 }
      );
    }

    const emailTaken = await prisma.user.findUnique({ where: { email } });
    if (emailTaken) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Get the owner's active tenant from their JWT (session already verified above)
    const ownerTenantId = session?.tenantId;

    const newStaff = await prisma.$transaction(async (tx) => {
      const staff = await tx.user.create({
        data: { name, email, passwordHash, role: role ?? "CASHIER" },
      });

      // Add staff to the same tenant as the owner
      if (ownerTenantId) {
        const memberRole =
          role === "OWNER" ? "owner"
          : role === "MANAGER" ? "manager"
          : role === "KITCHEN" ? "staff"
          : "cashier";

        await tx.tenantMembership.upsert({
          where: { tenantId_userId: { tenantId: ownerTenantId, userId: staff.id } },
          update: {},
          create: {
            tenantId: ownerTenantId,
            userId: staff.id,
            role: memberRole,
            status: "active",
            joinedAt: new Date(),
          },
        });
      }
      return staff;
    });

    return NextResponse.json(
      { user: { id: newStaff.id, name: newStaff.name, email: newStaff.email, role: newStaff.role } },
      { status: 201 }
    );
  } catch (err) {
    logger.error("auth/register", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
