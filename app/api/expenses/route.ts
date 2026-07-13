import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { z } from "zod";

const expenseSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  category: z.enum(["INGREDIENTS", "UTILITIES", "SALARIES", "MAINTENANCE", "MARKETING", "OTHER"]).optional(),
  date: z.string().optional(),
});

export async function GET(req: NextRequest) {
  return safeHandler("expenses/GET", async () => {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");

  const where = date ? {
    date: {
      gte: new Date(`${date}T00:00:00.000Z`),
      lte: new Date(`${date}T23:59:59.999Z`),
    },
  } : {};

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { date: "desc" },
    take: 100,
  });

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  return NextResponse.json({ expenses, total });
});
}

export async function POST(req: NextRequest) {
  return safeHandler("expenses/POST", async () => {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const body = await req.json();
  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const expense = await prisma.expense.create({
    data: {
      description: parsed.data.description,
      amount: parsed.data.amount,
      category: parsed.data.category ?? "OTHER",
      date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
      addedById: session.userId,
    },
  });

  return NextResponse.json({ expense }, { status: 201 });
});
}
