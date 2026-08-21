"use client";
import React, { useState, useEffect, useCallback } from "react";
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
type Forecast = {
  historical: { date: string; revenue: number; orders: number }[];
  forecast: { date: string; predicted: number; low: number; high: number }[];
  summary: { avgDailyRevenue: number; thisWeekRevenue: number; lastWeekRevenue: number; weekOnWeekGrowth: number; forecastNextWeek: number };
};

const kpiIcons: Record<string, React.ReactElement> = {
  revenue:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v2m0 8v2M9 8c0-1.1.9-2 3-2s3 .9 3 2-1 2-3 2-3 .9-3 2 .9 2 3 2 3-.9 3-2"/></svg>,
  orders:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
  avg:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0121 9.414V19a2 2 0 01-2 2z"/></svg>,
  tax:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-4m-5 0V5a2 2 0 012-2h2a2 2 0 012 2v2m-6 0h6"/></svg>,
};

const G = {
  green:  "rgba(16,185,129,0.12)",
  red:    "rgba(239,68,68,0.12)",
  blue:   "rgba(56,189,248,0.12)",
  indigo: "rgba(99,102,241,0.12)",
  amber:  "rgba(245,158,11,0.12)",
  glass:  "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.07)",
};

export default function HomePage() {
  const router = useRouter();
  const [stats, setStats]           = useState<Stats | null>(null);
  const [yday, setYday]             = useState<{ totalRevenue: number; totalOrders: number } | null>(null);
  const [orders, setOrders]         = useState<Order[]>([]);
  const [tables, setTables]         = useState<Table[]>([]);
  const [time, setTime]             = useState(new Date());
  const [loading, setLoading]       = useState(true);
  const [forecast, setForecast]     = useState<Forecast | null>(null);
  const [showForecast, setShowForecast] = useState(false);

  const load = useCallback(async () => {
    const [sRes, yRes, oRes, tRes, fRes] = await Promise.all([
      fetch("/api/reports?type=today"),
      fetch("/api/reports?type=yesterday"),
      fetch("/api/orders?status=PENDING"),
      fetch("/api/tables"),
      fetch("/api/forecasting"),
    ]);
    const [s, y, o, t, f] = await Promise.all([sRes.json(), yRes.json(), oRes.json(), tRes.json(), fRes.json()]);
    setStats(s); setYday(y); setOrders(o.orders ?? []); setTables(t.tables ?? []);
    setForecast(f); setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const di = setInterval(load, 30000);
    const ci = setInterval(() => setTime(new Date()), 1000);
    return () => { clearInterval(di); clearInterval(ci); };
  }, [load]);

  const freeTables     = tables.filter(t => t.status === "FREE").length;
  const occupiedTables = tables.filter(t => t.status === "OCCUPIED").length;

  function pct(today: number, yesterday: number) {
    if (!yesterday) return null;
    const d = ((today - yesterday) / yesterday) * 100;
    return { value: Math.abs(d).toFixed(1), up: d >= 0 };
  }

  const revPct = stats && yday ? pct(stats.totalRevenue, yday.totalRevenue) : null;
  const ordPct = stats && yday ? pct(stats.totalOrders,  yday.totalOrders)  : null;
  const hour = time.getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  const kpis = [
    { key: "revenue", label: "Today's Revenue", value: `₹${(stats?.totalRevenue ?? 0).toLocaleString("en-IN")}`, icon: kpiIcons.revenue, color: "#10b981", bg: G.green, pct: revPct },
    { key: "orders",  label: "Orders Today",    value: stats?.totalOrders ?? 0,                                    icon: kpiIcons.orders,  color: "#38bdf8", bg: G.blue,  pct: ordPct },
    { key: "avg",     label: "Avg Order Value", value: `₹${(stats?.avgOrderValue ?? 0).toLocaleString("en-IN")}`, icon: kpiIcons.avg,     color: "#818cf8", bg: G.indigo,pct: null },
    { key: "tax",     label: "Tax Collected",   value: `₹${(stats?.totalTax ?? 0).toLocaleString("en-IN")}`,      icon: kpiIcons.tax,     color: "#f59e0b", bg: G.amber, pct: null },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#f8fafc" }}>{greeting} 👋</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
            {time.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            {" · "}{time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowForecast(!showForecast)}>
            {showForecast ? "Hide Forecast" : "Show Forecast"}
          </button>
          <button className="btn btn-primary" onClick={() => router.push("/dashboard/tables")}>+ New Order</button>
        </div>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 14 }} />)}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
          {kpis.map(s => (
            <div key={s.key} className="card" style={{ padding: 20 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: s.bg, border: `1px solid ${s.color}30`, display: "flex", alignItems: "center", justifyContent: "center", color: s.color }}>
                {s.icon}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color, margin: "8px 0 2px" }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{s.label}</div>
              {s.pct && (
                <div style={{ fontSize: 11, color: s.pct.up ? "#10b981" : "#ef4444", fontWeight: 600, marginTop: 4, display: "flex", alignItems: "center", gap: 3 }}>
                  <span>{s.pct.up ? "▲" : "▼"}</span> {s.pct.value}% vs yesterday
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Forecast Panel */}
      {showForecast && forecast && (
        <div className="card" style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#f8fafc" }}>7-Day Revenue Forecast</h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>Based on last 30 days · Moving avg + linear regression</p>
            </div>
            <div style={{ display: "flex", gap: 20, textAlign: "right" }}>
              <div>
                <div style={{ fontWeight: 800, color: forecast.summary.weekOnWeekGrowth >= 0 ? "#10b981" : "#ef4444" }}>
                  {forecast.summary.weekOnWeekGrowth >= 0 ? "▲" : "▼"} {Math.abs(forecast.summary.weekOnWeekGrowth)}%
                </div>
                <div style={{ fontSize: 11, color: "#64748b" }}>Week-on-week</div>
              </div>
              <div>
                <div style={{ fontWeight: 800, color: "#818cf8" }}>₹{forecast.summary.forecastNextWeek.toLocaleString("en-IN")}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>Forecast next 7d</div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 120 }}>
            {forecast.historical.slice(-7).map((d, i) => {
              const maxH = Math.max(...forecast.historical.slice(-7).map(x => x.revenue), ...forecast.forecast.map(x => x.high), 1);
              return (
                <div key={`h${i}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", background: "rgba(255,255,255,0.12)", borderRadius: "4px 4px 0 0", height: `${(d.revenue / maxH) * 90}px`, minHeight: 2 }} title={`₹${d.revenue}`} />
                  <div style={{ fontSize: 9, color: "#64748b", textAlign: "center", whiteSpace: "nowrap" }}>{d.date}</div>
                </div>
              );
            })}
            <div style={{ width: 1, background: "rgba(255,255,255,0.1)", alignSelf: "stretch", margin: "0 4px" }} />
            {forecast.forecast.map((f, i) => {
              const maxH = Math.max(...forecast.historical.slice(-7).map(x => x.revenue), ...forecast.forecast.map(x => x.high), 1);
              return (
                <div key={`f${i}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", position: "relative", height: `${(f.high / maxH) * 90}px`, minHeight: 4 }}>
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(99,102,241,0.15)", borderRadius: "4px 4px 0 0", height: "100%" }} />
                    <div style={{ position: "absolute", bottom: 0, left: "10%", right: "10%", background: "#6366f1", borderRadius: "4px 4px 0 0", height: `${(f.predicted / f.high) * 100}%` }} />
                  </div>
                  <div style={{ fontSize: 9, color: "#818cf8", textAlign: "center", whiteSpace: "nowrap" }}>{f.date}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 11, color: "#64748b" }}>
            <span>▪ <span style={{ color: "rgba(255,255,255,0.5)" }}>Historical</span></span>
            <span>▪ <span style={{ color: "#6366f1" }}>Predicted</span></span>
            <span>▪ <span style={{ color: "rgba(99,102,241,0.4)" }}>Range</span></span>
          </div>
        </div>
      )}

      {/* Tables + Payments */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Table Status */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#f8fafc" }}>Table Status</h3>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Free",     count: freeTables,     color: "#10b981", bg: G.green },
              { label: "Occupied", count: occupiedTables, color: "#ef4444", bg: G.red },
              { label: "Total",    count: tables.length,  color: "#38bdf8", bg: G.blue },
            ].map(t => (
              <div key={t.label} style={{ flex: 1, background: t.bg, borderRadius: 10, padding: "12px", textAlign: "center", border: `1px solid ${t.color}25` }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: t.color }}>{t.count}</div>
                <div style={{ fontSize: 11, color: t.color, opacity: 0.8 }}>{t.label}</div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => router.push("/dashboard/tables")}>Manage Tables →</button>
        </div>

        {/* Payment Breakdown */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#f8fafc" }}>Today&apos;s Payments</h3>
          {loading ? <div className="skeleton" style={{ height: 60, borderRadius: 8 }} /> :
            Object.keys(stats?.paymentBreakdown ?? {}).length === 0
              ? <div style={{ color: "#64748b", fontSize: 13, padding: "20px 0" }}>No payments yet</div>
              : Object.entries(stats?.paymentBreakdown ?? {}).map(([mode, amount]) => {
                  const total = Object.values(stats?.paymentBreakdown ?? {}).reduce((s, v) => s + v, 0);
                  return (
                    <div key={mode} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <span style={{ color: "#94a3b8" }}>{mode}</span>
                        <span style={{ fontWeight: 700, color: "#f8fafc" }}>₹{amount.toLocaleString("en-IN")}</span>
                      </div>
                      <div style={{ height: 5, background: "rgba(255,255,255,0.07)", borderRadius: 4 }}>
                        <div style={{ height: "100%", borderRadius: 4, background: "linear-gradient(90deg,#6366f1,#8b5cf6)", width: `${total > 0 ? (amount / total) * 100 : 0}%`, transition: "width .3s" }} />
                      </div>
                    </div>
                  );
                })
          }
        </div>
      </div>

      {/* Pending Orders */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f8fafc", display: "flex", alignItems: "center", gap: 8 }}>
            Pending Orders
            {orders.length > 0 && (
              <span style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 9999, padding: "1px 8px", fontSize: 12, fontWeight: 700 }}>
                {orders.length}
              </span>
            )}
          </h3>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push("/dashboard/orders")}>View All →</button>
        </div>
        {orders.length === 0
          ? <div style={{ textAlign: "center", padding: "30px 0", color: "#64748b" }}>No pending orders 🎉</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {orders.slice(0, 5).map(o => (
                <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: G.amber, borderRadius: 9, border: "1px solid rgba(245,158,11,0.2)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 700, color: "#f8fafc" }}>#{o.orderNumber}</span>
                    {o.table && <span style={{ fontSize: 12, color: "#94a3b8" }}>Table {o.table.number}</span>}
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>{o.type}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000)}m ago
                  </div>
                </div>
              ))}
              {orders.length > 5 && <div style={{ textAlign: "center", fontSize: 12, color: "#64748b", padding: "4px 0" }}>+{orders.length - 5} more</div>}
            </div>
        }
      </div>

      {/* Top Items */}
      {stats && stats.topItems?.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#f8fafc" }}>Top Items Today</h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {stats.topItems.slice(0, 6).map((item, i) => (
              <div key={item.name} style={{ background: G.glass, borderRadius: 9, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, border: `1px solid ${G.border}` }}>
                <span style={{ fontSize: 16 }}>{["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣"][i]}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#f8fafc" }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{item.quantity} sold</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
