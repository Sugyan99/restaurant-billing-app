"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import MuiKpiCard from "../../components/MuiKpiCard";

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
    setForecast(f);
    setLoading(false);
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

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{greeting} 👋</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748B" }}>
            {time.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            {" · "}{time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowForecast(!showForecast)}>
            {showForecast ? "📊 Hide Forecast" : "🔮 Show Forecast"}
          </button>
          <button className="btn btn-primary" onClick={() => router.push("/dashboard/tables")}>+ New Order</button>
        </div>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 110 }} />)}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
          {[
            { label: "Today's Revenue", value: `₹${(stats?.totalRevenue ?? 0).toLocaleString("en-IN")}`, icon: "💰", color: "#16A34A", pct: revPct },
            { label: "Orders Today",    value: stats?.totalOrders ?? 0,                                    icon: "🧾", color: "#2563EB", pct: ordPct },
            { label: "Avg Order Value", value: `₹${(stats?.avgOrderValue ?? 0).toLocaleString("en-IN")}`, icon: "📊", color: "#7C3AED", pct: null },
            { label: "Tax Collected",   value: `₹${(stats?.totalTax ?? 0).toLocaleString("en-IN")}`,      icon: "🏛️", color: "#D97706", pct: null },
          ].map((s, index) => (
            index === 0 ? (
              <MuiKpiCard
                key={s.label}
                label={s.label}
                value={s.value}
                trend={s.pct ? { value: s.pct.value, up: s.pct.up } : null}
              />
            ) : (
              <div key={s.label} className="card" style={{ padding: 20 }}>
                <div style={{ fontSize: 26 }}>{s.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.color, margin: "4px 0 2px" }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "#64748B" }}>{s.label}</div>
                {s.pct && (
                  <div style={{ fontSize: 11, color: s.pct.up ? "#16A34A" : "#DC2626", fontWeight: 600, marginTop: 4 }}>
                    {s.pct.up ? "▲" : "▼"} {s.pct.value}% vs yesterday
                  </div>
                )}
              </div>
            )
          ))}
        </div>
      )}

      {/* Forecast Panel */}
      {showForecast && forecast && (
        <div className="card" style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>🔮 7-Day Revenue Forecast</h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B" }}>Based on last 30 days trend · Blend of moving avg + linear regression</p>
            </div>
            <div style={{ display: "flex", gap: 20, textAlign: "right" }}>
              <div>
                <div style={{ fontWeight: 800, color: forecast.summary.weekOnWeekGrowth >= 0 ? "#16A34A" : "#DC2626" }}>
                  {forecast.summary.weekOnWeekGrowth >= 0 ? "▲" : "▼"} {Math.abs(forecast.summary.weekOnWeekGrowth)}%
                </div>
                <div style={{ fontSize: 11, color: "#64748B" }}>Week-on-week</div>
              </div>
              <div>
                <div style={{ fontWeight: 800, color: "#2563EB" }}>₹{forecast.summary.forecastNextWeek.toLocaleString("en-IN")}</div>
                <div style={{ fontSize: 11, color: "#64748B" }}>Forecast next 7d</div>
              </div>
            </div>
          </div>

          {/* Simple bar chart of forecast */}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 120 }}>
            {/* Historical last 7 */}
            {forecast.historical.slice(-7).map((d, i) => {
              const maxH = Math.max(...forecast.historical.slice(-7).map(x => x.revenue), ...forecast.forecast.map(x => x.high), 1);
              return (
                <div key={`h${i}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", background: "#E2E8F0", borderRadius: "4px 4px 0 0", height: `${(d.revenue / maxH) * 90}px`, minHeight: 2 }} title={`₹${d.revenue}`} />
                  <div style={{ fontSize: 9, color: "#94A3B8", textAlign: "center", whiteSpace: "nowrap" }}>{d.date}</div>
                </div>
              );
            })}
            <div style={{ width: 1, background: "#CBD5E1", alignSelf: "stretch", margin: "0 4px" }} />
            {/* Forecast 7 days */}
            {forecast.forecast.map((f, i) => {
              const maxH = Math.max(...forecast.historical.slice(-7).map(x => x.revenue), ...forecast.forecast.map(x => x.high), 1);
              return (
                <div key={`f${i}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", position: "relative", height: `${(f.high / maxH) * 90}px`, minHeight: 4 }}>
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#DBEAFE", borderRadius: "4px 4px 0 0", height: "100%" }} title={`High: ₹${f.high}`} />
                    <div style={{ position: "absolute", bottom: 0, left: "10%", right: "10%", background: "#2563EB", borderRadius: "4px 4px 0 0", height: `${(f.predicted / f.high) * 100}%` }} title={`₹${f.predicted}`} />
                  </div>
                  <div style={{ fontSize: 9, color: "#2563EB", textAlign: "center", whiteSpace: "nowrap" }}>{f.date}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 11, color: "#64748B" }}>
            <span>◼ <span style={{ color: "#E2E8F0" }}>█</span> Historical</span>
            <span>◼ <span style={{ color: "#2563EB" }}>█</span> Predicted</span>
            <span>◼ <span style={{ color: "#DBEAFE" }}>█</span> Range (±20%)</span>
          </div>
        </div>
      )}

      {/* Tables + Pending Orders */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Table Status */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Table Status</h3>
          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            {[
              { label: "Free",     count: freeTables,     color: "#16A34A", bg: "#F0FDF4" },
              { label: "Occupied", count: occupiedTables, color: "#DC2626", bg: "#FEF2F2" },
              { label: "Total",    count: tables.length,  color: "#2563EB", bg: "#EFF6FF" },
            ].map(t => (
              <div key={t.label} style={{ flex: 1, background: t.bg, borderRadius: 10, padding: "12px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: t.color }}>{t.count}</div>
                <div style={{ fontSize: 11, color: t.color }}>{t.label}</div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => router.push("/dashboard/tables")}>Manage Tables →</button>
        </div>

        {/* Payment Breakdown */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Today's Payments</h3>
          {loading ? <div className="skeleton" style={{ height: 60 }} /> :
            Object.keys(stats?.paymentBreakdown ?? {}).length === 0
              ? <div style={{ color: "#94A3B8", fontSize: 13, padding: "20px 0" }}>No payments yet</div>
              : Object.entries(stats?.paymentBreakdown ?? {}).map(([mode, amount]) => {
                  const total = Object.values(stats?.paymentBreakdown ?? {}).reduce((s, v) => s + v, 0);
                  return (
                    <div key={mode} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                        <span>{mode}</span>
                        <span style={{ fontWeight: 700 }}>₹{amount.toLocaleString("en-IN")}</span>
                      </div>
                      <div style={{ height: 6, background: "#F1F5F9", borderRadius: 4 }}>
                        <div style={{ height: "100%", borderRadius: 4, background: "var(--primary)", width: `${total > 0 ? (amount / total) * 100 : 0}%` }} />
                      </div>
                    </div>
                  );
                })
          }
        </div>
      </div>

      {/* Pending Orders */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Pending Orders {orders.length > 0 && <span style={{ background: "#FEF2F2", color: "#DC2626", borderRadius: 9999, padding: "2px 8px", fontSize: 12 }}>{orders.length}</span>}</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push("/dashboard/orders")}>View All →</button>
        </div>
        {orders.length === 0
          ? <div style={{ textAlign: "center", padding: "30px 0", color: "#94A3B8" }}>No pending orders 🎉</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {orders.slice(0, 5).map(o => (
                <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#FFF7ED", borderRadius: 8 }}>
                  <div>
                    <span style={{ fontWeight: 700 }}>#{o.orderNumber}</span>
                    {o.table && <span style={{ marginLeft: 8, fontSize: 12, color: "#64748B" }}>Table {o.table.number}</span>}
                    <span style={{ marginLeft: 8, fontSize: 12, color: "#64748B" }}>{o.type}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#94A3B8" }}>
                    {Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000)}m ago
                  </div>
                </div>
              ))}
              {orders.length > 5 && <div style={{ textAlign: "center", fontSize: 12, color: "#94A3B8" }}>+{orders.length - 5} more</div>}
            </div>
        }
      </div>

      {/* Top Items */}
      {stats && stats.topItems?.length > 0 && (
        <div className="card" style={{ padding: 20, marginTop: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Top Items Today</h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {stats.topItems.slice(0, 6).map((item, i) => (
              <div key={item.name} style={{ background: "#F8FAFC", borderRadius: 8, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                <span>{["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣"][i]}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>{item.quantity} sold</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
