import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { safeHandler } from "@/lib/apiHandler";

export async function GET(req: NextRequest) {
  return safeHandler("notifications/GET", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;
    const notifications = await withTenant(session.tenantId, session.userId, (tx) => tx.notification.findMany({
      where: {
        tenantId: session.tenantId,
        OR: [{ role: null }, { role: session.role }],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }));
    const unreadCount = notifications.filter(n => !n.isRead).length;
    return NextResponse.json({ notifications, unreadCount });
  });
}

export async function POST(req: NextRequest) {
  return safeHandler("notifications/POST", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;
    const { type, title, message, role } = await req.json();
    if (!title || !message) return NextResponse.json({ error: "Title and message required" }, { status: 400 });
    const n = await withTenant(session.tenantId, session.userId, (tx) => tx.notification.create({
      data: {
        id: `notif_${Date.now()}`,
        tenantId: session.tenantId,
        type: type ?? "INFO",
        title,
        message,
        role: role ?? null,
      },
    }));
    return NextResponse.json({ notification: n }, { status: 201 });
  });
}

export async function PUT(req: NextRequest) {
  return safeHandler("notifications/PUT", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;
    await withTenant(session.tenantId, session.userId, (tx) => tx.notification.updateMany({
      where: {
        tenantId: session.tenantId,
        isRead: false,
        OR: [
          { userId: session.userId },
          { userId: null, OR: [{ role: null }, { role: session.role }] },
        ],
      },
      data: { isRead: true },
    }));
    return NextResponse.json({ success: true });
  });
}
