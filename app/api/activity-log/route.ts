import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  return safeHandler("activity-log/GET", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;

    const { searchParams } = new URL(req.url);
    const date   = searchParams.get("date");
    const search = searchParams.get("search") ?? "";

    const since = date
      ? new Date(`${date}T00:00:00.000Z`)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const until = date ? new Date(`${date}T23:59:59.999Z`) : new Date();

    const [auditRows, billingRows, users] = await Promise.all([
      prisma.auditLog.findMany({
        where: { createdAt: { gte: since, lte: until } },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.billingAuditLog.findMany({
        where: { createdAt: { gte: since, lte: until } },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.user.findMany({ select: { id: true, name: true, role: true } }),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));

    const logs = [
      ...auditRows.map((r) => ({
        id:        r.id,
        action:    r.action,
        entity:    r.entity,
        entityId:  r.entityId,
        actor:     userMap.get(r.userId ?? "")?.name ?? r.userId ?? "System",
        actorRole: userMap.get(r.userId ?? "")?.role ?? "—",
        meta:      r.meta,
        createdAt: r.createdAt,
        source:    "general" as const,
      })),
      ...billingRows.map((r) => ({
        id:        r.id,
        action:    r.action,
        entity:    "Bill",
        entityId:  r.billId ?? r.orderId,
        actor:     userMap.get(r.actor)?.name ?? r.actor,
        actorRole: userMap.get(r.actor)?.role ?? "—",
        meta:      r.meta,
        createdAt: r.createdAt,
        source:    "billing" as const,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .filter((l) =>
        !search ||
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        l.actor.toLowerCase().includes(search.toLowerCase()) ||
        l.entity.toLowerCase().includes(search.toLowerCase())
      )
      .slice(0, 300);

    return NextResponse.json({ logs });
  });
}
