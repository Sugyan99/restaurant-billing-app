import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { safeHandler } from "@/lib/apiHandler";
import { z } from "zod";

const clockInSchema = z.object({
  userId: z.string().optional(),  // OWNER/MANAGER can clock in others
  note:   z.string().max(200).optional(),
});

const clockOutSchema = z.object({
  attendanceId: z.string(),
  breakMins:    z.number().int().min(0).max(480).default(0),
  note:         z.string().max(200).optional(),
});

// GET /api/attendance?date=2024-01-15&userId=xxx
export async function GET(req: NextRequest) {
  return safeHandler("attendance/GET", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const userId    = searchParams.get("userId");
    const month     = searchParams.get("month"); // YYYY-MM

    const tid = session.tenantId;

    if (month) {
      const [year, m] = month.split("-").map(Number);
      const start = new Date(year, m - 1, 1);
      const end   = new Date(year, m, 1);
      const records = await withTenant(session.tenantId, session.userId, (tx) => tx.attendance.findMany({
        where: { tenantId: tid, ...(userId ? { userId } : {}), date: { gte: start, lt: end } },
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: [{ date: "desc" }, { clockIn: "desc" }],
      }));
      return NextResponse.json({ records });
    }

    const date = dateParam ? new Date(dateParam) : new Date();
    date.setHours(0, 0, 0, 0);
    const nextDay = new Date(date); nextDay.setDate(date.getDate() + 1);

    const [records, users] = await withTenant(session.tenantId, session.userId, async (tx) => {
      // Also get all active users for this tenant
      const memberIds = (await tx.tenantMembership.findMany({
        where: { tenantId: tid, status: "active" },
        select: { userId: true },
      })).map(m => m.userId);

      return Promise.all([
        tx.attendance.findMany({
          where: { tenantId: tid, date: { gte: date, lt: nextDay } },
          include: { user: { select: { id: true, name: true, role: true } } },
          orderBy: { clockIn: "asc" },
        }),
        tx.user.findMany({
          where: { id: { in: memberIds }, isActive: true },
          select: { id: true, name: true, role: true },
          orderBy: { name: "asc" },
        }),
      ]);
    });

    return NextResponse.json({ records, users, date: date.toISOString() });
  });
}

// POST /api/attendance  — clock in
export async function POST(req: NextRequest) {
  return safeHandler("attendance/POST", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;

    const parsed = clockInSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

    const tid    = session.tenantId;
    const userId = parsed.data.userId && ["OWNER","MANAGER"].includes(session.role)
      ? parsed.data.userId
      : session.userId;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const now = new Date();

    const result = await withTenant(session.tenantId, session.userId, async (tx) => {
      // Verify user is in this tenant
      const membership = await tx.tenantMembership.findFirst({ where: { tenantId: tid, userId, status: "active" } });
      if (!membership) return { notMember: true } as const;

      // Check already clocked in today
      const existing = await tx.attendance.findFirst({
        where: { tenantId: tid, userId, date: today, clockOut: null },
      });
      if (existing) return { alreadyIn: existing } as const;

      const attendance = await tx.attendance.create({
        data: {
          id: `att_${Date.now()}`,
          tenantId: tid,
          userId,
          clockIn: now,
          date: today,
          note: parsed.data.note ?? null,
        },
        include: { user: { select: { id: true, name: true, role: true } } },
      });
      return { attendance } as const;
    });

    if ("notMember" in result) return NextResponse.json({ error: "User not found in this restaurant" }, { status: 404 });
    if ("alreadyIn" in result) return NextResponse.json({ error: "Already clocked in", attendance: result.alreadyIn }, { status: 409 });
    return NextResponse.json({ attendance: result.attendance }, { status: 201 });
  });
}

// PUT /api/attendance  — clock out
export async function PUT(req: NextRequest) {
  return safeHandler("attendance/PUT", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;

    const parsed = clockOutSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

    const tid = session.tenantId;
    const now = new Date();

    const result = await withTenant(session.tenantId, session.userId, async (tx) => {
      const record = await tx.attendance.findFirst({
        where: { id: parsed.data.attendanceId, tenantId: tid },
      });
      if (!record) return { notFound: true } as const;

      const isManager = ["OWNER","MANAGER"].includes(session.role);
      if (record.userId !== session.userId && !isManager) return { forbidden: true } as const;
      if (record.clockOut) return { alreadyOut: true } as const;

      const updated = await tx.attendance.update({
        where: { id: record.id },
        data: { clockOut: now, breakMins: parsed.data.breakMins, note: parsed.data.note ?? record.note },
        include: { user: { select: { id: true, name: true, role: true } } },
      });

      const totalMins = Math.floor((now.getTime() - record.clockIn.getTime()) / 60000);
      const workedMins = Math.max(0, totalMins - parsed.data.breakMins);
      return { updated, workedHours: (workedMins / 60).toFixed(2) } as const;
    });

    if ("notFound" in result) return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });
    if ("forbidden" in result) return NextResponse.json({ error: "Cannot clock out another user" }, { status: 403 });
    if ("alreadyOut" in result) return NextResponse.json({ error: "Already clocked out" }, { status: 409 });
    return NextResponse.json({ attendance: result.updated, workedHours: result.workedHours });
  });
}
