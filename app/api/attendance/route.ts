import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
      const records = await prisma.attendance.findMany({
        where: { tenantId: tid, ...(userId ? { userId } : {}), date: { gte: start, lt: end } },
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: [{ date: "desc" }, { clockIn: "desc" }],
      });
      return NextResponse.json({ records });
    }

    const date = dateParam ? new Date(dateParam) : new Date();
    date.setHours(0, 0, 0, 0);
    const nextDay = new Date(date); nextDay.setDate(date.getDate() + 1);

    // Also get all active users for this tenant
    const memberIds = (await prisma.tenantMembership.findMany({
      where: { tenantId: tid, status: "active" },
      select: { userId: true },
    })).map(m => m.userId);

    const [records, users] = await Promise.all([
      prisma.attendance.findMany({
        where: { tenantId: tid, date: { gte: date, lt: nextDay } },
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: { clockIn: "asc" },
      }),
      prisma.user.findMany({
        where: { id: { in: memberIds }, isActive: true },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      }),
    ]);

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

    // Verify user is in this tenant
    const membership = await prisma.tenantMembership.findFirst({ where: { tenantId: tid, userId, status: "active" } });
    if (!membership) return NextResponse.json({ error: "User not found in this restaurant" }, { status: 404 });

    // Check already clocked in today
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const existing = await prisma.attendance.findFirst({
      where: { tenantId: tid, userId, date: today, clockOut: null },
    });
    if (existing) return NextResponse.json({ error: "Already clocked in", attendance: existing }, { status: 409 });

    const now = new Date();
    const attendance = await prisma.attendance.create({
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

    return NextResponse.json({ attendance }, { status: 201 });
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
    const record = await prisma.attendance.findFirst({
      where: { id: parsed.data.attendanceId, tenantId: tid },
    });
    if (!record) return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });

    // Only self or manager can clock out
    const isManager = ["OWNER","MANAGER"].includes(session.role);
    if (record.userId !== session.userId && !isManager) {
      return NextResponse.json({ error: "Cannot clock out another user" }, { status: 403 });
    }

    if (record.clockOut) return NextResponse.json({ error: "Already clocked out" }, { status: 409 });

    const now = new Date();
    const updated = await prisma.attendance.update({
      where: { id: record.id },
      data: { clockOut: now, breakMins: parsed.data.breakMins, note: parsed.data.note ?? record.note },
      include: { user: { select: { id: true, name: true, role: true } } },
    });

    const totalMins = Math.floor((now.getTime() - record.clockIn.getTime()) / 60000);
    const workedMins = Math.max(0, totalMins - parsed.data.breakMins);

    return NextResponse.json({ attendance: updated, workedHours: (workedMins / 60).toFixed(2) });
  });
}
