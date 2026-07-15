"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type Stats = {
  totalRevenue: number; totalOrders: number; avgOrderValue: number; totalTax: number;
  paymentBreakdown: Record<string, number>;
  topItems: { name: string; quantity: number; revenue: number }[];
};
type Order = {
  id: string; orderNumber: number; status: string; type: string;
  createdAt: string; table?: { number: string };
  items: { quantity: number; price: number }[];
};
type Table = { id: string; number: string; status: string };

export default function HomePage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [time, setTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [trend, setTrend] = useState<{daily:{date:string;revenue:number;orders:number}[];peakHour:{hour:string;revenue:string}|null}|null>(null);

  const load = useCallback(async () => {
    const [statsRes, ordersRes, tablesRes, trendRes] = await Promise.all([
      fetch("/api/reports?type=today"),
      fetch("/api/orders?status=PENDING"),
      fetch("/api/tables"),
      fetch("/api/sales-trend"),
    ]);
    const [s, o, t, tr] = await Promise.all([statsRes.json(), ordersRes.json(), tablesRes.json(), trendRes.json()]);
    setStats(s);
    setOrders(o.orders ?? []);
    setTables(t.tables ?? []);
    setTrend(tr);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const dataInterval = setInterval(load, 30000);
    const clockInterval = setInterval(() => setTime(new Date()), 1000);
    return () => { clearInterval(dataInterval); clearInterval(clockInterval); };
  }, [load]);

  const freeTables = tables.filter(t => t.status === "FREE").length;
  const occupiedTables = tables.filter(t => t.status === "OCCUPIED").length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Good {time.getHours() < 12 ? "Morning" : time.getHours() < 17 ? "Afternoon" : "Evening"} 👋</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748B" }}>
            {time.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div style={{ background: "#0F1623", borderRadius: 12, padding: "8px 16px", textAlign: "right" }}>
          <div style={{ color: "#E8721C", fontWeight: 800, fontSize: 22, fontFamily: "monospace" }}>
            {time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
          <div style={{ color: "#64748B", fontSize: 11 }}>Live Clock</div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        {[
          { label: "Today's Revenue", value: `₹${stats?.totalRevenue.toFixed(0) ?? "—"}`, sub: `${stats?.totalOrders ?? 0} orders paid`, color: "#16A34A", icon: "💰", bg: "#F0FDF4" },
          { label: "Pending Orders", value: orders.length, sub: "in kitchen queue", color: "#E8721C", icon: "🍳", bg: "#FFF7ED" },
          { label: "Free Tables", value: `${freeTables}/${tables.length}`, sub: `${occupiedTables} occupied`, color: "#2563EB", icon: "🪑", bg: "#EFF6FF" },
          { label: "Avg Order Value", value: `₹${stats?.avgOrderValue.toFixed(0) ?? "—"}`, sub: "per transaction", color: "#7C3AED", icon: "📊", bg: "#F5F3FF" },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ borderTop: `3px solid ${s.color}`, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 12, right: 16, fontSize: 24, opacity: 0.15 }}>{s.icon}</div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px", color: "#374151" }}>Quick Actions</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
          {[
            { icon: "🪑", label: "New Order", path: "/dashboard/tables", color: "#E8721C" },
            { icon: "🧾", label: "Bills", path: "/dashboard/bills", color: "#16A34A" },
            { icon: "🍳", label: "Kitchen View", path: "/dashboard/orders", color: "#2563EB" },
            { icon: "🍽️", label: "Menu", path: "/dashboard/menu", color: "#7C3AED" },
            { icon: "💰", label: "Add Expense", path: "/dashboard/expenses", color: "#D97706" },
            { icon: "🔒", label: "Day Close", path: "/dashboard/day-close", color: "#64748B" },
          ].map(({ icon, label, path, color }) => (
            <button key={path} onClick={() => router.push(path)} style={{
              background: "white", border: `1px solid #E2E8F0`, borderRadius: 12,
              padding: "16px 12px", cursor: "pointer", textAlign: "center",
              transition: "all 0.15s", display: "flex", flexDirection: "column",
              alignItems: "center", gap: 8,
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = color; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#E2E8F0"; (e.currentTarget as HTMLElement).style.transform = "none"; }}
            >
              <span style={{ fontSize: 24 }}>{icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Pending Orders */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">🍳 Pending Orders</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => router.push("/dashboard/orders")}>View All</button>
          </div>
          {orders.length === 0 ? (
            <div style={{ padding: "24px 20px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
              No pending orders 🎉
            </div>
          ) : (
            orders.slice(0, 5).map(o => {
              const age = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000);
              return (
                <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", borderBottom: "1px solid #F1F5F9" }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>
                      {o.table ? `Table ${o.table.number}` : o.type}
                    </span>
                    <span style={{ marginLeft: 8, fontSize: 11, color: "#64748B" }}>#{o.orderNumber}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: age > 20 ? "#DC2626" : age > 10 ? "#D97706" : "#16A34A" }}>
                    {age}m ago
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Top Items Today */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">🏆 Top Items Today</h3></div>
          {!stats?.topItems?.length ? (
            <div style={{ padding: "24px 20px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
              No sales data yet today
            </div>
          ) : (
            stats.topItems.slice(0, 5).map((item, i) => (
              <div key={item.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", borderBottom: "1px solid #F1F5F9" }}>
                <span style={{ fontSize: 13 }}>
                  <span style={{ color: "#E8721C", fontWeight: 800, marginRight: 8 }}>#{i + 1}</span>
                  {item.name}
                </span>
                <span style={{ fontSize: 12, color: "#64748B" }}>{item.quantity} sold</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 7-day trend chart */}
      {trend?.daily && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <h3 className="card-title">📈 7-Day Revenue Trend</h3>
            {trend.peakHour && <span style={{ fontSize: 12, color: "#64748B" }}>Peak: {trend.peakHour.hour}:00 — ₹{trend.peakHour.revenue}</span>}
          </div>
          <div className="card-body">
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 80 }}>
              {trend.daily.map((d, i) => {
                const max = Math.max(...trend.daily.map(x => x.revenue), 1);
                const h = Math.max((d.revenue / max) * 72, 4);
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 9, color: "#64748B" }}>₹{d.revenue > 999 ? `${(d.revenue/1000).toFixed(1)}k` : d.revenue}</span>
                    <div style={{ width: "100%", height: h, background: i === 6 ? "#E8721C" : "#E8721C40", borderRadius: 4, transition: "height 0.3s" }} />
                    <span style={{ fontSize: 9, color: "#94A3B8" }}>{d.date}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
