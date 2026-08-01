"use client";
import { useState, useEffect, useCallback } from "react";
import { showToast } from "@/components/Toast";

type Order = {
  id: string; orderNumber: number; type: string; status: string; createdAt: string;
  isPriority: boolean; kotNote?: string; customerName?: string; customerPhone?: string;
  items: { id: string; quantity: number; menuItem: { name: string }; price: number }[];
  bill?: { total: number; paymentStatus: string };
};

const STATUS_NEXT: Record<string, string> = { PENDING: "PREPARING", PREPARING: "READY", READY: "SERVED" };
const STATUS_COLOR: Record<string, string> = { PENDING: "#EA580C", PREPARING: "#2563EB", READY: "#16A34A", SERVED: "#94A3B8", CANCELLED: "#DC2626" };
const STATUS_BG: Record<string, string>    = { PENDING: "#FFF7ED", PREPARING: "#EFF6FF", READY: "#F0FDF4", SERVED: "#F8FAFC", CANCELLED: "#FEF2F2" };

export default function DeliveryPage() {
  const [orders, setOrders]   = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<"ALL" | "TAKEAWAY" | "DELIVERY">("ALL");
  const [statusF, setStatusF] = useState("ACTIVE");

  const load = useCallback(async () => {
    const res = await fetch("/api/orders");
    const d   = await res.json();
    const all: Order[] = d.orders ?? [];
    setOrders(all.filter(o => o.type === "TAKEAWAY" || o.type === "DELIVERY"));
    setLoading(false);
  }, []);

  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, [load]);

  function elapsed(createdAt: string) {
    const m = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  async function updateStatus(o: Order, status: string) {
    const res = await fetch(`/api/orders/${o.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) { showToast(`#${o.orderNumber} → ${status}`); load(); }
    else showToast("Failed to update", "error");
  }

  function printKOT(o: Order) {
    const w = window.open("", "_blank", "width=320,height=480");
    if (!w) return;
    w.document.write(`<html><head><title>KOT #${o.orderNumber}</title>
<style>body{font-family:monospace;font-size:13px;padding:12px;max-width:280px}h2{text-align:center;margin:0 0 4px}p{text-align:center;margin:2px 0;font-size:11px}hr{border:none;border-top:1px dashed #000;margin:6px 0}.row{display:flex;justify-content:space-between;margin:3px 0}</style></head><body>
<h2>${o.type === "DELIVERY" ? "🛵 DELIVERY" : "🥡 TAKEAWAY"}</h2>
<p><b>Order #${o.orderNumber}</b></p>
${o.customerName ? `<p>${o.customerName}${o.customerPhone ? ` · ${o.customerPhone}` : ""}</p>` : ""}
<p>${new Date(o.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
<hr/>
${o.items.map(i => `<div class="row"><span>${i.menuItem.name}</span><span><b>×${i.quantity}</b></span></div>`).join("")}
<hr/>
${o.kotNote ? `<p>Note: ${o.kotNote}</p><hr/>` : ""}
<p style="font-size:10px">** KOT **</p>
</body></html>`);
    w.document.close(); setTimeout(() => w.print(), 300);
  }

  let displayed = orders;
  if (filter !== "ALL") displayed = displayed.filter(o => o.type === filter);
  if (statusF === "ACTIVE") displayed = displayed.filter(o => ["PENDING","PREPARING","READY"].includes(o.status));
  else if (["PENDING","PREPARING","READY","SERVED","CANCELLED"].includes(statusF)) displayed = displayed.filter(o => o.status === statusF);

  const active    = orders.filter(o => ["PENDING","PREPARING","READY"].includes(o.status));
  const delivery  = orders.filter(o => o.type === "DELIVERY");
  const takeaway  = orders.filter(o => o.type === "TAKEAWAY");

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Delivery & Takeaway</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>
            {active.length} active · {delivery.length} delivery · {takeaway.length} takeaway
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: 18 }}>
        {[
          ["🛵 Delivery", delivery.filter(o=>["PENDING","PREPARING","READY"].includes(o.status)).length, "#6366F1"],
          ["🥡 Takeaway", takeaway.filter(o=>["PENDING","PREPARING","READY"].includes(o.status)).length, "#EA580C"],
          ["✅ Served Today", orders.filter(o=>o.status==="SERVED").length, "#16A34A"],
          ["❌ Cancelled", orders.filter(o=>o.status==="CANCELLED").length, "#DC2626"],
        ].map(([label, val, color]) => (
          <div key={label as string} className="card" style={{ padding: "12px 16px", borderLeft: `3px solid ${color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: color as string }}>{val}</div>
            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Type tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {(["ALL","DELIVERY","TAKEAWAY"] as const).map(t => (
          <button key={t} className={`btn btn-sm ${filter === t ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(t)}>
            {t === "DELIVERY" ? "🛵 Delivery" : t === "TAKEAWAY" ? "🥡 Takeaway" : "All"}
          </button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {["ACTIVE","PENDING","PREPARING","READY","SERVED","ALL"].map(s => (
            <button key={s} className={`btn btn-sm ${statusF === s ? "btn-primary" : "btn-ghost"}`} onClick={() => setStatusF(s)} style={{ fontSize: 11 }}>{s}</button>
          ))}
        </div>
      </div>

      {/* Orders grid */}
      {loading ? <p style={{ color: "#94A3B8" }}>Loading…</p> : displayed.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>{filter === "DELIVERY" ? "🛵" : "🥡"}</div>
          <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>No {filter === "ALL" ? "delivery or takeaway" : filter.toLowerCase()} orders</p>
          <p style={{ fontSize: 13, margin: "4px 0 0" }}>Create one from KOT page → New KOT</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
          {displayed.map(o => {
            const next   = STATUS_NEXT[o.status];
            const bg     = STATUS_BG[o.status]    ?? "#fff";
            const color  = STATUS_COLOR[o.status] ?? "#64748B";
            const isLate = o.status === "PENDING" && (Date.now() - new Date(o.createdAt).getTime()) > 15 * 60000;
            const subtotal = o.items.reduce((s, i) => s + i.price * i.quantity, 0);
            return (
              <div key={o.id} style={{ background: bg, border: `2px solid ${isLate ? "#DC2626" : color}20`, borderRadius: 12,
                boxShadow: isLate ? "0 0 0 3px rgba(220,38,38,0.15)" : "none" }}>
                {/* Card header */}
                <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 16 }}>{o.type === "DELIVERY" ? "🛵" : "🥡"}</span>
                      <span style={{ fontWeight: 800 }}>#{o.orderNumber}</span>
                      {o.isPriority && <span style={{ fontSize: 10, background: "#E8721C", color: "#fff", borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>★</span>}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: isLate ? "#DC2626" : "#64748B", fontWeight: isLate ? 700 : 400 }}>⏱ {elapsed(o.createdAt)}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}15`, borderRadius: 5, padding: "2px 6px" }}>{o.status}</span>
                    </div>
                  </div>
                  {(o.customerName || o.customerPhone) && (
                    <div style={{ fontSize: 12, color: "#374151", marginTop: 5 }}>
                      👤 {o.customerName ?? "—"} {o.customerPhone && <span style={{ color: "#64748B" }}>· {o.customerPhone}</span>}
                    </div>
                  )}
                </div>

                {/* Items */}
                <div style={{ padding: "8px 14px", maxHeight: 120, overflowY: "auto" }}>
                  {o.items.map(item => (
                    <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
                      <span>{item.menuItem.name}</span>
                      <span style={{ fontWeight: 700 }}>×{item.quantity}</span>
                    </div>
                  ))}
                  {o.kotNote && <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4, borderTop: "1px dashed #E2E8F0", paddingTop: 4 }}>🗒 {o.kotNote}</div>}
                </div>

                {/* Footer */}
                <div style={{ padding: "8px 14px 12px", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
                    <span style={{ color: "#64748B" }}>Subtotal</span>
                    <span style={{ fontWeight: 700 }}>₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: "center", fontSize: 11 }} onClick={() => printKOT(o)}>🖨️ Print</button>
                    {next && (
                      <button className="btn btn-primary btn-sm" style={{ flex: 2, justifyContent: "center", fontSize: 11 }} onClick={() => updateStatus(o, next)}>
                        → {next}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
