import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeHandler } from "@/lib/apiHandler";
import { requireStaffPermission, isStaffAuthError, type StaffSession } from "@/lib/staffAuth";
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuid = z.string().uuid();

async function activity(session: StaffSession, action: string, entity: string, entityId?: string, metadata: Record<string, unknown> = {}) {
  await prisma.$executeRaw`
    insert into public.staff_activity (tenant_id,user_id,action,entity,entity_id,metadata)
    values (${session.tenantId}::uuid,${session.userId},${action},${entity},${entityId ?? null},${JSON.stringify(metadata)}::jsonb)
  `;
}

export async function GET(req: NextRequest) {
  return safeHandler("staff/GET", async () => {
    const { searchParams } = new URL(req.url);
    const view = searchParams.get("view") ?? "dashboard";
    const session = await requireStaffPermission(req, view === "login-logs" ? "staff.login_logs" : `staff.${view === "staff" ? "view" : view}`);
    if (isStaffAuthError(session)) return session;
    const tid = session.tenantId;
    const self = session.role !== "OWNER" && session.role !== "MANAGER";
    const userFilter = self ? `and x.user_id = '${session.userId.replace(/'/g, "''")}'` : "";

    if (view === "staff") {
      if (self) return NextResponse.json({ error: "Manager access required" }, { status: 403 });
      const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
        select u.id,u.name,u.email,u.phone,u.role,u."isActive" as is_active,u.salary,u."createdAt" as created_at,
               tm.role as tenant_role, tm.status as membership_status
        from public."User" u join public.tenant_memberships tm on tm.user_id=u.id and tm.tenant_id='${tid}'::uuid
        order by u."isActive" desc,u.name asc
      `);
      return NextResponse.json({ staff: rows });
    }

    if (view === "dashboard") {
      const [counts, shifts, performance, commissions, closings, failures, recent] = await Promise.all([
        prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`select count(*) filter (where tm.status='active' and u."isActive") as active_staff,count(*) filter (where tm.status='active') as members from public.tenant_memberships tm join public."User" u on u.id=tm.user_id where tm.tenant_id='${tid}'::uuid`),
        prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`select count(*) as scheduled,count(*) filter (where status='completed') as completed from public.staff_shifts where tenant_id='${tid}'::uuid and shift_date=current_date${self ? ` and user_id='${session.userId.replace(/'/g, "''")}'` : ""}`),
        prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`select coalesce(round(avg(rating),2),0) as avg_rating,coalesce(round(avg(case when target>0 then least(achieved/target*100,100) else 0 end),2),0) as target_percent from public.staff_performance where tenant_id='${tid}'::uuid and period_end >= date_trunc('month',current_date)::date${self ? ` and user_id='${session.userId.replace(/'/g, "''")}'` : ""}`),
        prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`select coalesce(sum(amount) filter (where status='pending'),0) as pending,coalesce(sum(amount) filter (where status='paid'),0) as paid from public.staff_commissions where tenant_id='${tid}'::uuid${self ? ` and user_id='${session.userId.replace(/'/g, "''")}'` : ""}`),
        prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`select coalesce(sum(variance),0) as variance, count(*) as closings from public.cashier_closings where tenant_id='${tid}'::uuid and closing_date >= current_date-30${self ? ` and user_id='${session.userId.replace(/'/g, "''")}'` : ""}`),
        prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`select count(*) as failed from public.staff_login_logs where tenant_id='${tid}'::uuid and success=false and created_at >= now()-interval '24 hours'${self ? ` and user_id='${session.userId.replace(/'/g, "''")}'` : ""}`),
        prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`select a.id,a.action,a.entity,a.entity_id,a.metadata,a.created_at,u.name,u.role from public.staff_activity a left join public."User" u on u.id=a.user_id where a.tenant_id='${tid}'::uuid${self ? ` and a.user_id='${session.userId.replace(/'/g, "''")}'` : ""} order by a.created_at desc limit 12`),
      ]);
      return NextResponse.json({ counts: counts[0] ?? {}, shifts: shifts[0] ?? {}, performance: performance[0] ?? {}, commissions: commissions[0] ?? {}, closings: closings[0] ?? {}, loginSecurity: failures[0] ?? {}, recentActivity: recent });
    }

    const date = searchParams.get("date");
    const from = date ?? new Date().toISOString().slice(0,10);
    const to = date ?? from;

    if (view === "shifts") {
      const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`select s.*,u.name,u.role from public.staff_shifts s join public."User" u on u.id=s.user_id where s.tenant_id='${tid}'::uuid and s.shift_date between '${from}'::date and '${to}'::date${self ? ` and s.user_id='${session.userId.replace(/'/g, "''")}'` : ""} order by s.shift_date desc,s.start_time asc`);
      return NextResponse.json({ rows });
    }
    if (view === "performance") {
      const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`select p.*,u.name,u.role from public.staff_performance p join public."User" u on u.id=p.user_id where p.tenant_id='${tid}'::uuid${self ? ` and p.user_id='${session.userId.replace(/'/g, "''")}'` : ""} order by p.period_end desc limit 200`);
      return NextResponse.json({ rows });
    }
    if (view === "commission") {
      const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`select c.*,u.name,u.role from public.staff_commissions c join public."User" u on u.id=c.user_id where c.tenant_id='${tid}'::uuid${self ? ` and c.user_id='${session.userId.replace(/'/g, "''")}'` : ""} order by c.period_end desc limit 200`);
      return NextResponse.json({ rows });
    }
    if (view === "login-logs") {
      if (self) return NextResponse.json({ error: "Manager access required" }, { status: 403 });
      const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`select l.*,u.name,u.role from public.staff_login_logs l left join public."User" u on u.id=l.user_id where l.tenant_id='${tid}'::uuid and l.created_at >= '${from}'::date and l.created_at < ('${to}'::date + interval '1 day') order by l.created_at desc limit 300`);
      return NextResponse.json({ rows });
    }
    if (view === "activity") {
      if (self) return NextResponse.json({ error: "Manager access required" }, { status: 403 });
      const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`select a.*,u.name,u.role from public.staff_activity a left join public."User" u on u.id=a.user_id where a.tenant_id='${tid}'::uuid and a.created_at >= '${from}'::date and a.created_at < ('${to}'::date + interval '1 day') order by a.created_at desc limit 300`);
      return NextResponse.json({ rows });
    }
    if (view === "cashier-closing") {
      const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`select c.*,u.name,u.role,ap.name as approver_name from public.cashier_closings c join public."User" u on u.id=c.user_id left join public."User" ap on ap.id=c.approved_by where c.tenant_id='${tid}'::uuid${self ? ` and c.user_id='${session.userId.replace(/'/g, "''")}'` : ""} order by c.closing_date desc limit 200`);
      return NextResponse.json({ rows });
    }
    return NextResponse.json({ error: "Unknown staff view" }, { status: 400 });
  });
}

export async function POST(req: NextRequest) {
  return safeHandler("staff/POST", async () => {
    const body = await req.json();
    const action = z.string().min(1).parse(body.action);
    const session = await requireStaffPermission(req, `staff.${action === "closing" ? "cashier_closing" : action === "permission_override" ? "manage" : action}`);
    if (isStaffAuthError(session)) return session;
    const tid = session.tenantId;

    if (action === "shift") {
      if (!["OWNER","MANAGER"].includes(session.role)) return NextResponse.json({ error: "Manager access required" }, { status: 403 });
      const p = z.object({ userId:z.string().min(1), shiftDate:isoDate, startTime:z.string().datetime(), endTime:z.string().datetime(), note:z.string().max(500).optional() }).parse(body);
      const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`insert into public.staff_shifts(tenant_id,user_id,shift_date,start_time,end_time,note,created_by) values (${tid}::uuid,${p.userId},${p.shiftDate}::date,${p.startTime}::timestamptz,${p.endTime}::timestamptz,${p.note ?? null},${session.userId}) returning *`;
      await activity(session,"CREATE","shift",String(rows[0]?.id),{userId:p.userId,shiftDate:p.shiftDate});
      return NextResponse.json({ row: rows[0] }, { status: 201 });
    }

    if (action === "performance") {
      if (!["OWNER","MANAGER"].includes(session.role)) return NextResponse.json({ error: "Manager access required" }, { status: 403 });
      const p = z.object({ userId:z.string().min(1), periodStart:isoDate, periodEnd:isoDate, rating:z.number().min(0).max(5), target:z.number().min(0).default(0), achieved:z.number().min(0).default(0), notes:z.string().max(2000).optional() }).parse(body);
      const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`insert into public.staff_performance(tenant_id,user_id,reviewer_id,period_start,period_end,rating,target,achieved,notes) values (${tid}::uuid,${p.userId},${session.userId},${p.periodStart}::date,${p.periodEnd}::date,${p.rating},${p.target},${p.achieved},${p.notes ?? null}) returning *`;
      await activity(session,"CREATE","performance",String(rows[0]?.id),{userId:p.userId,rating:p.rating});
      return NextResponse.json({ row: rows[0] }, { status: 201 });
    }

    if (action === "commission") {
      if (!["OWNER","MANAGER"].includes(session.role)) return NextResponse.json({ error: "Manager access required" }, { status: 403 });
      const p = z.object({ userId:z.string().min(1), periodStart:isoDate, periodEnd:isoDate, basisAmount:z.number().min(0), rate:z.number().min(0).max(100), note:z.string().max(1000).optional() }).parse(body);
      const amount = Math.round(p.basisAmount * p.rate) / 100;
      const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`insert into public.staff_commissions(tenant_id,user_id,period_start,period_end,basis_amount,rate,amount,note) values (${tid}::uuid,${p.userId},${p.periodStart}::date,${p.periodEnd}::date,${p.basisAmount},${p.rate},${amount},${p.note ?? null}) returning *`;
      await activity(session,"CREATE","commission",String(rows[0]?.id),{userId:p.userId,amount});
      return NextResponse.json({ row: rows[0] }, { status: 201 });
    }

    if (action === "permission_override") {
      if (session.role !== "OWNER") return NextResponse.json({ error: "Owner access required" }, { status: 403 });
      const p = z.object({ userId:z.string().min(1), permission:z.string().min(3).max(100), allowed:z.boolean() }).parse(body);
      const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`insert into public.staff_permission_overrides(tenant_id,user_id,permission,allowed) values (${tid}::uuid,${p.userId},${p.permission},${p.allowed}) on conflict (tenant_id,user_id,permission) do update set allowed=excluded.allowed,updated_at=now() returning *`;
      await activity(session,"UPDATE","permission",String(rows[0]?.id),{userId:p.userId,permission:p.permission,allowed:p.allowed});
      return NextResponse.json({ row: rows[0] });
    }

    if (action === "closing") {
      const p = z.object({ userId:z.string().optional(), closingDate:isoDate, openingCash:z.number().min(0), actualCash:z.number().min(0), notes:z.string().max(1000).optional() }).parse(body);
      const targetUser = p.userId && ["OWNER","MANAGER"].includes(session.role) ? p.userId : session.userId;
      const sales = await prisma.$queryRaw<Array<{ cash_sales: number | string }>>`
        select coalesce(sum(coalesce(b."paidAmount",b.total)),0) as cash_sales
        from public."Bill" b join public."Order" o on o.id=b."orderId"
        where b.tenant_id=${tid}::uuid and o."createdById"=${targetUser}
          and b."paymentMode"='CASH' and b."paymentStatus"='PAID'
          and b."createdAt">=${p.closingDate}::date and b."createdAt"<(${p.closingDate}::date+interval '1 day')
      `;
      const expectedCash = Number(p.openingCash) + Number(sales[0]?.cash_sales ?? 0);
      const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`insert into public.cashier_closings(tenant_id,user_id,closing_date,opening_cash,expected_cash,actual_cash,notes) values (${tid}::uuid,${targetUser},${p.closingDate}::date,${p.openingCash},${expectedCash},${p.actualCash},${p.notes ?? null}) on conflict (tenant_id,user_id,closing_date) do update set opening_cash=excluded.opening_cash,expected_cash=excluded.expected_cash,actual_cash=excluded.actual_cash,notes=excluded.notes,closed_at=now() returning *`;
      await activity(session,"CREATE","cashier_closing",String(rows[0]?.id),{userId:targetUser,closingDate:p.closingDate,expectedCash,actualCash:p.actualCash});
      return NextResponse.json({ row: rows[0], expectedCash });
    }

    return NextResponse.json({ error: "Unknown staff action" }, { status: 400 });
  });
}

export async function PATCH(req: NextRequest) {
  return safeHandler("staff/PATCH", async () => {
    const body = await req.json();
    const action = z.string().parse(body.action);
    const session = await requireStaffPermission(req, action === "approve_closing" ? "staff.cashier_closing" : `staff.${action}`);
    if (isStaffAuthError(session)) return session;
    if (action === "approve_closing") {
      if (!["OWNER","MANAGER"].includes(session.role)) return NextResponse.json({ error: "Manager access required" }, { status: 403 });
      const id = uuid.parse(body.id);
      const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`update public.cashier_closings set status='approved',approved_by=${session.userId} where id=${id} and tenant_id=${session.tenantId}::uuid returning *`;
      if (!rows[0]) return NextResponse.json({ error: "Closing not found" }, { status: 404 });
      await activity(session,"APPROVE","cashier_closing",id,{status:"approved"});
      return NextResponse.json({ row: rows[0] });
    }
    if (action === "shift_status") {
      if (!["OWNER","MANAGER"].includes(session.role)) return NextResponse.json({ error: "Manager access required" }, { status: 403 });
      const id = uuid.parse(body.id);
      const status = z.enum(["scheduled","completed","missed","cancelled"]).parse(body.status);
      const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`update public.staff_shifts set status=${status} where id=${id} and tenant_id=${session.tenantId}::uuid returning *`;
      if (!rows[0]) return NextResponse.json({ error: "Shift not found" }, { status: 404 });
      await activity(session,"UPDATE","shift",id,{status});
      return NextResponse.json({ row: rows[0] });
    }
    if (action === "commission_status") {
      if (!["OWNER","MANAGER"].includes(session.role)) return NextResponse.json({ error: "Manager access required" }, { status: 403 });
      const id = uuid.parse(body.id);
      const status = z.enum(["pending","approved","paid","void"]).parse(body.status);
      const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`update public.staff_commissions set status=${status},approved_by=case when ${status}='approved' then ${session.userId} else approved_by end,paid_at=case when ${status}='paid' then now() else paid_at end where id=${id} and tenant_id=${session.tenantId}::uuid returning *`;
      if (!rows[0]) return NextResponse.json({ error: "Commission not found" }, { status: 404 });
      await activity(session,"UPDATE","commission",id,{status});
      return NextResponse.json({ row: rows[0] });
    }
    return NextResponse.json({ error: "Unknown staff update" }, { status: 400 });
  });
}
