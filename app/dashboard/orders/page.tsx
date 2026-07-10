"use client";
import { useState, useEffect, useCallback } from "react";
import { showToast } from "@/components/Toast";

type Order = {
  id: string; orderNumber: number; status: string; type: string;
  customerName?: string; createdAt: string;
  table?: { number: string };
  items: { id: string; quantity: number; price: number; menuItem: { name: string } }[];
  bill?: { id: string; paymentStatus: string; total: number };
};

const STATUS_FLOW: Record<string, string> = {
  PENDING: "PREPARING",
  PREPARING: "READY",
  READY: "SERVED",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<"ACTIVE" | "ALL">("ACTIVE");
  const [view, setView] = useState<"KOT" | "LIST">("KOT");

  const load = useCallback(async () => {
    const res = await fetch("/api/orders");
    const data = await res.json();
    setOrders(data.orders ?? []);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  function printKOT(order: Order) {
    const w = window.open("", "_blank", "width=300,height=500");
    if (!w) return;
    w.document.write(`
      <html><head><title>KOT #${order.orderNumber}</title>
      <style>body{font-family:monospace;font-size:14px;padding:12px;max-width:280px}
      h2{text-align:center;margin:0 0 4px;font-size:16px}
      p{text-align:center;margin:2px 0;font-size:12px}
      hr{border:none;border-top:1px dashed #000;margin:8px 0}
      .item{display:flex;justify-content:space-between;margin:4px 0;font-size:13px}
      .notes{font-size:11px;color:#666;margin:-2px 0 4px 0}
      </style></head><body>
      <h2>KITCHEN ORDER</h2>
      <p><b>${order.table ? "Table: " + order.table.number : order.type}</b></p>
      <p>Order #${order.orderNumber}</p>
      <p>${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
      <hr/>
      ${order.items.map(i => `
        <div class="item"><span>${i.menuItem.name}</span><span><b>x${i.quantity}</b></span></div>
        ${i.notes ? '<div class="notes">Note: ' + i.notes + '</div>' : ''}
      `).join("")}
      <hr/>
      <p style="text-align:center;font-size:11px">** KOT **</p>
      </body></html>
    `);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  async function updateStatus(order: Order, newStatus: string) {
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      showToast(`Order #${order.orderNumber} → ${newStatus}`);
      await load();
    }
  }

  const active = orders.filter((o) => ["PENDING", "PREPARING", "READY"].includes(o.status));
  const displayed = filter === "ACTIVE" ? active : orders;

  const statusColor: Record<string, string> = {
    PENDING: "#FFF7ED", PREPARING: "#EFF6FF", READY: "#F0FDF4",
    SERVED: "#F8FAFC", CANCELLED: "#FEF2F2"
  };
  const statusBorder: Record<string, string> = {
    PENDING: "#FDBA74", PREPARING: "#93C5FD", READY: "#86EFAC",
    SERVED: "#E2E8F0", CANCELLED: "#FECACA"
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Orders</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>
            {active.length} active · auto-refreshes every 10s
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={`btn btn-sm ${view === "KOT" ? "btn-primary" : "btn-ghost"}`} onClick={() => setView("KOT")}>🍳 KOT View</button>
          <button className={`btn btn-sm ${view === "LIST" ? "btn-primary" : "btn-ghost"}`} onClick={() => setView("LIST")}>📋 List View</button>
          <button className={`btn btn-sm ${filter === "ACTIVE" ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(filter === "ACTIVE" ? "ALL" : "ACTIVE")}>
            {filter === "ACTIVE" ? "Showing Active" : "Showing All"}
          </button>
        </div>
      </div>

      {displayed.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🍳</div>
          <p style={{ fontSize: 15, fontWeight: 600 }}>No active orders</p>
          <p style={{ fontSize: 13 }}>Orders will appear here automatically when placed from Tables page</p>
        </div>
      ) : view === "KOT" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {displayed.map((order) => {
            const orderAge = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
            const nextStatus = STATUS_FLOW[order.status];
            return (
              <div key={order.id} style={{
                background: statusColor[order.status] ?? "white",
                border: `2px solid ${statusBorder[order.status] ?? "#E2E8F0"}`,
                borderRadius: 12, overflow: "hidden"
              }}>
                {/* Card Header */}
                <div style={{ padding: "12px 14px", background: "rgba(0,0,0,0.04)", borderBottom: `1px solid ${statusBorder[order.status]}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 800, fontSize: 16 }}>
                      {order.table ? `Table ${order.table.number}` : order.type}
                    </span>
                    <span style={{ fontSize: 11, color: orderAge > 20 ? "#DC2626" : "#64748B", fontWeight: orderAge > 20 ? 700 : 400 }}>
                      {orderAge}m ago
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: "#64748B" }}>Order #{order.orderNumber}</span>
                    <span className={`badge badge-${order.status.toLowerCase()}`}>{order.status}</span>
                  </div>
                </div>

                {/* Items */}
                <div style={{ padding: "10px 14px" }}>
                  {order.items.map((item) => (
                    <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderBottom: "1px dashed rgba(0,0,0,0.08)" }}>
                      <span>{item.menuItem.name}</span>
                      <span style={{ fontWeight: 700, minWidth: 28, textAlign: "right" }}>×{item.quantity}</span>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ padding: "10px 14px", display: "flex", gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: "center" }}
                    onClick={() => printKOT(order)}>🖨️ KOT</button>
                  {nextStatus && (
                    <button className="btn btn-primary btn-sm" style={{ flex: 2, justifyContent: "center" }}
                      onClick={() => updateStatus(order, nextStatus)}>
                      → {nextStatus}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                  {["Order #", "Table/Type", "Items", "Amount", "Status", "Time", "Actions"].map((h) => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((order) => {
                  const total = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
                  const nextStatus = STATUS_FLOW[order.status];
                  return (
                    <tr key={order.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 700 }}>#{order.orderNumber}</td>
                      <td style={{ padding: "12px 16px" }}>{order.table ? `Table ${order.table.number}` : order.type}</td>
                      <td style={{ padding: "12px 16px", color: "#64748B" }}>{order.items.length} items</td>
                      <td style={{ padding: "12px 16px", fontWeight: 700, color: "#E8721C" }}>₹{total.toFixed(2)}</td>
                      <td style={{ padding: "12px 16px" }}><span className={`badge badge-${order.status.toLowerCase()}`}>{order.status}</span></td>
                      <td style={{ padding: "12px 16px", color: "#64748B" }}>
                        {new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {nextStatus && (
                          <button className="btn btn-ghost btn-sm" onClick={() => updateStatus(order, nextStatus)}>
                            → {nextStatus}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
