"use client";
import { useState, useEffect, useCallback } from "react";

type QrItem = { name: string; price: number; quantity: number; notes?: string; isVeg: boolean };
type QrOrder = { id: string; tableNumber: string; customerName: string; customerPhone?: string; status: string; items: QrItem[]; notes?: string; createdAt: string; orderId?: string };

const STATUS_COLOR: Record<string, string> = {
  PENDING:  "#D97706",
  APPROVED: "#16A34A",
  REJECTED: "#DC2626",
};
const STATUS_BG: Record<string, string> = {
  PENDING:  "#FEF3C7",
  APPROVED: "#DCFCE7",
  REJECTED: "#FEE2E2",
};

function elapsed(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function QrOrdersPage() {
  const [orders, setOrders]     = useState<QrOrder[]>([]);
  const [loading, setLoading]   = useState(true);
  const [actioning, setAction]  = useState<string | null>(null);
  const [filter, setFilter]     = useState<"PENDING" | "ALL">("PENDING");

  const load = useCallback(async () => {
    const res  = await fetch("/api/qr/pending");
    const data = await res.json();
    setOrders(data.orders ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [load]);

  async function approve(id: string) {
    setAction(id);
    const res  = await fetch(`/api/qr/approve/${id}`, { method: "POST" });
    const data = await res.json();
    setAction(null);
    if (!res.ok) return alert(data.error ?? "Failed to approve");
    await load();
  }

  async function reject(id: string) {
    if (!confirm("Reject this QR order?")) return;
    setAction(id);
    await fetch(`/api/qr/reject/${id}`, { method: "POST" });
    setAction(null);
    await load();
  }

  const pending = orders.filter((o) => o.status === "PENDING");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>QR Orders</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>Customer orders placed via QR menu</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {pending.length > 0 && (
            <span style={{ background: "#E8721C", color: "white", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>
              {pending.length} Pending
            </span>
          )}
          <button onClick={load} style={{ background: "#F1F5F9", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>Loading…</div>
      ) : orders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: "#94A3B8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>
          <p style={{ fontWeight: 600 }}>No pending QR orders</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Orders will appear here when customers scan their table QR code.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {orders.map((order) => {
            const total  = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
            const busy   = actioning === order.id;
            const isPending = order.status === "PENDING";

            return (
              <div key={order.id} className="card" style={{ border: isPending ? "2px solid #E8721C" : "1px solid #E2E8F0" }}>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 800 }}>Table {order.tableNumber}</span>
                      <span style={{ background: STATUS_BG[order.status] ?? "#F1F5F9", color: STATUS_COLOR[order.status] ?? "#64748B", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
                        {order.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>
                      👤 {order.customerName}
                      {order.customerPhone && <span style={{ marginLeft: 6 }}>· 📞 {order.customerPhone}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: "#E8721C" }}>₹{total.toFixed(0)}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>{elapsed(order.createdAt)}</div>
                  </div>
                </div>

                <div style={{ padding: "12px 16px" }}>
                  {order.items.map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderBottom: "1px solid #F8FAFC" }}>
                      <div>
                        <span style={{ marginRight: 6 }}>{item.isVeg ? "🟢" : "🔴"}</span>
                        <span style={{ fontWeight: 600 }}>{item.name}</span>
                        {item.notes && <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: 4 }}>({item.notes})</span>}
                      </div>
                      <span style={{ color: "#64748B" }}>×{item.quantity}</span>
                    </div>
                  ))}
                  {order.notes && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#64748B", background: "#FFF7ED", borderRadius: 6, padding: "6px 10px" }}>
                      📝 {order.notes}
                    </div>
                  )}
                </div>

                {isPending && (
                  <div style={{ padding: "12px 16px", display: "flex", gap: 10, borderTop: "1px solid #F1F5F9" }}>
                    <button onClick={() => approve(order.id)} disabled={busy}
                      style={{ flex: 1, background: busy ? "#94A3B8" : "#16A34A", color: "white", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, fontSize: 14, cursor: busy ? "not-allowed" : "pointer" }}>
                      {busy ? "Processing…" : "✅ Approve & Fire KOT"}
                    </button>
                    <button onClick={() => reject(order.id)} disabled={busy}
                      style={{ background: "#FEE2E2", color: "#DC2626", border: "none", borderRadius: 8, padding: "10px 14px", fontWeight: 700, fontSize: 13, cursor: busy ? "not-allowed" : "pointer" }}>
                      ✕
                    </button>
                  </div>
                )}

                {order.status === "APPROVED" && order.orderId && (
                  <div style={{ padding: "10px 16px", background: "#F0FDF4", borderTop: "1px solid #DCFCE7", fontSize: 12, color: "#16A34A", fontWeight: 600 }}>
                    ✅ KOT fired · <a href="/dashboard/orders" style={{ color: "#16A34A" }}>View in Kitchen →</a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
