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

  const load = useCallback(async () => {
    const [statsRes, ordersRes, tablesRes] = await Promise.all([
      fetch("/api/reports?type=today"),
      fetch("/api/orders?status=PENDING"),
      fetch("/api/tables"),
    ]);
    const [s, o, t] = await Promise.all([statsRes.json(), ordersRes.json(), tablesRes.json()]);
    setStats(s);
    setOrders(o.orders ?? []);
    setTables(t.tables ?? []);
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
        <div className="stat-card" style={{ borderLeft: "4px solid #16A34A" }}>
          <div className="stat-label">Today's Revenue</div>
          <div className="stat-value" style={{ color: "#16A34A" }}>₹{stats?.totalRevenue.toFixed(0) ?? "—"}</div>
          <div className="stat-sub">{stats?.totalOrders ?? 0} orders paid</div>
        </div>
        <div className="stat-card" style={{ borderLeft: "4px solid #E8721C" }}>
          <div className="stat-label">Pending Orders</div>
          <div className="stat-value" style={{ color: "#E8721C" }}>{orders.length}</div>
          <div className="stat-sub">waiting in kitchen</div>
        </div>
        <div className="stat-card" style={{ borderLeft: "4px solid #2563EB" }}>
          <div className="stat-label">Tables</div>
          <div className="stat-value">{freeTables}<span style={{ fontSize: 14, color: "#64748B" }}>/{tables.length}</span></div>
          <div className="stat-sub">{occupiedTables} occupied</div>
        </div>
        <div className="stat-card" style={{ borderLeft: "4px solid #7C3AED" }}>
          <div className="stat-label">Avg Order Value</div>
          <div className="stat-value" style={{ fontSize: 22 }}>₹{stats?.avgOrderValue.toFixed(0) ?? "—"}</div>
        </div>
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
    </div>
  );
}
