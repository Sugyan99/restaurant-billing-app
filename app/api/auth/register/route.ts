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

    const existingUserCount = await prisma.user.count();

    if (existingUserCount === 0) {
      // No users exist yet (first-time setup) — allow self-registration as OWNER.
      // This is how the restaurant owner creates their very first account.
      const passwordHash = await hashPassword(password);
      const owner = await prisma.user.create({
        data: { name, email, passwordHash, role: "OWNER" },
      });
      return NextResponse.json(
        { user: { id: owner.id, name: owner.name, email: owner.email, role: owner.role } },
        { status: 201 }
      );
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

    const passwordHash = await hashPassword(password);
    const newStaff = await prisma.user.create({
      data: { name, email, passwordHash, role: role ?? "CASHIER" },
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
