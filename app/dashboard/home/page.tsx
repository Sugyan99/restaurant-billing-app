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
      <style>{HOME_3D_CSS}</style>

      {/* 3D Hero Banner */}
      <div className="hd-hero">
        <div className="hd-hero-bg">
          <span className="hd-orb hd-o1"/><span className="hd-orb hd-o2"/>
          <span className="hd-geo hd-g1">⬡</span><span className="hd-geo hd-g2">◈</span>
          <span className="hd-geo hd-g3">⬟</span><span className="hd-geo hd-g4">◆</span>
        </div>
        <div className="hd-hero-content">
          <div>
            <h2 className="hd-greeting">{greeting} 👋</h2>
            <p className="hd-time">
              {time.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
              {" · "}{time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          </div>
          <div className="hd-actions">
            <div className="hd-live-badge"><span className="hd-live-dot"/>Live</div>
            <button className="hd-btn-ghost" onClick={() => setShowForecast(!showForecast)}>
              {showForecast ? "📊 Hide Forecast" : "🔮 Show Forecast"}
            </button>
            <button className="hd-btn-primary" onClick={() => router.push("/dashboard/tables")}>+ New Order</button>
          </div>
        </div>
        <div className="hd-hero-chips">
          {[
            { icon:"🪑", label:"Tables", val: `${occupiedTables}/${tables.length}`, color:"#E8721C" },
            { icon:"🍳", label:"Pending", val: orders.length, color:"#DC2626" },
            { icon:"💰", label:"Revenue", val:`₹${((stats?.totalRevenue??0)/1000).toFixed(1)}k`, color:"#16A34A" },
          ].map(c => (
            <div key={c.label} className="hd-chip" style={{"--chip-color":c.color} as never}>
              <span className="hd-chip-icon">{c.icon}</span>
              <div><div className="hd-chip-val" style={{color:c.color}}>{c.val}</div><div className="hd-chip-lbl">{c.label}</div></div>
            </div>
          ))}
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
          ].map(s => (
            <div key={s.label} className="card kpi-3d" style={{ padding: 20 }}>
              <div className="kpi-icon-wrap" style={{"--kc":s.color} as never}>
                <span className="kpi-icon-inner" style={{fontSize:22}}>{s.icon}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color, margin: "4px 0 2px" }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "#64748B" }}>{s.label}</div>
              {s.pct && (
                <div style={{ fontSize: 11, color: s.pct.up ? "#16A34A" : "#DC2626", fontWeight: 600, marginTop: 4 }}>
                  {s.pct.up ? "▲" : "▼"} {s.pct.value}% vs yesterday
                </div>
              )}
            </div>
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

const HOME_3D_CSS = `
/* ═══ 3D HERO BANNER ═══ */
.hd-hero{
  position:relative;border-radius:20px;overflow:hidden;margin-bottom:24px;
  background:linear-gradient(135deg,#0F1623 0%,#1A2232 60%,#0F1623 100%);
  border:1px solid rgba(232,114,28,0.18);
  box-shadow:0 8px 40px rgba(0,0,0,0.14),0 2px 8px rgba(0,0,0,0.08),inset 0 1px 0 rgba(255,255,255,0.06);
}
.hd-hero-bg{position:absolute;inset:0;pointer-events:none;overflow:hidden;}
.hd-orb{position:absolute;border-radius:50%;filter:blur(60px);}
.hd-o1{width:300px;height:300px;top:-100px;left:-60px;background:radial-gradient(circle,rgba(232,114,28,0.14),transparent 70%);animation:hdO1 10s ease-in-out infinite;}
.hd-o2{width:240px;height:240px;bottom:-80px;right:10%;background:radial-gradient(circle,rgba(99,102,241,0.1),transparent 70%);animation:hdO2 14s ease-in-out infinite;}
@keyframes hdO1{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,12px)}}
@keyframes hdO2{0%,100%{transform:translate(0,0)}50%{transform:translate(-16px,-20px)}}
.hd-geo{position:absolute;opacity:0.055;font-size:36px;line-height:1;pointer-events:none;animation:hdGeo linear infinite;}
.hd-g1{top:12%;left:8%;color:#E8721C;animation-duration:18s;}
.hd-g2{top:55%;left:18%;color:#6366F1;animation-duration:22s;animation-delay:-6s;font-size:24px;}
.hd-g3{top:20%;right:12%;color:#F59E0B;animation-duration:20s;animation-delay:-10s;font-size:28px;}
.hd-g4{bottom:15%;right:25%;color:#E8721C;animation-duration:16s;animation-delay:-4s;font-size:20px;}
@keyframes hdGeo{0%,100%{transform:rotate(0deg) scale(1)}50%{transform:rotate(180deg) scale(1.15)}}

.hd-hero-content{
  position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;
  padding:24px 28px 16px;gap:16px;flex-wrap:wrap;
}
.hd-greeting{margin:0;font-size:22px;font-weight:800;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,0.3);}
.hd-time{margin:4px 0 0;font-size:13px;color:#94A3B8;}
.hd-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.hd-live-badge{
  display:flex;align-items:center;gap:6px;
  background:rgba(22,163,74,0.12);border:1px solid rgba(22,163,74,0.25);
  border-radius:20px;padding:4px 12px;font-size:11px;font-weight:700;color:#4ADE80;
  backdrop-filter:blur(8px);
}
.hd-live-dot{
  width:6px;height:6px;border-radius:50%;background:#22C55E;flex-shrink:0;
  box-shadow:0 0 6px #22C55E;animation:hdPulse 2s ease-in-out infinite;
}
@keyframes hdPulse{0%,100%{box-shadow:0 0 6px #22C55E}50%{box-shadow:0 0 12px #22C55E,0 0 20px rgba(34,197,94,0.3)}}
.hd-btn-ghost{
  padding:7px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;
  background:rgba(255,255,255,0.07);color:#CBD5E1;
  border:1px solid rgba(255,255,255,0.12);transition:all .2s;
  box-shadow:0 2px 8px rgba(0,0,0,0.15),inset 0 1px 0 rgba(255,255,255,0.06);
}
.hd-btn-ghost:hover{background:rgba(255,255,255,0.12);color:#fff;border-color:rgba(255,255,255,0.2);}
.hd-btn-primary{
  padding:7px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;
  background:linear-gradient(135deg,#E8721C,#C45A0E);color:#fff;border:none;
  box-shadow:0 4px 16px rgba(232,114,28,0.45),inset 0 1px 0 rgba(255,255,255,0.18),inset 0 -2px 4px rgba(0,0,0,0.15);
  transition:all .2s;
}
.hd-btn-primary:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(232,114,28,0.55),inset 0 1px 0 rgba(255,255,255,0.22);}

/* 3D chips row */
.hd-hero-chips{
  position:relative;z-index:1;display:flex;gap:12px;padding:0 28px 20px;flex-wrap:wrap;
}
.hd-chip{
  display:flex;align-items:center;gap:10px;
  background:rgba(255,255,255,0.04);border-radius:12px;
  padding:10px 16px;border:1px solid rgba(255,255,255,0.07);
  backdrop-filter:blur(10px);flex:1;min-width:100px;
  box-shadow:0 4px 16px rgba(0,0,0,0.18),inset 0 1px 0 rgba(255,255,255,0.06);
  transition:transform .2s ease,box-shadow .2s ease;cursor:default;transform-style:preserve-3d;
}
.hd-chip:hover{
  transform:perspective(300px) translateZ(8px) translateY(-2px);
  box-shadow:0 10px 28px rgba(0,0,0,0.22),inset 0 1px 0 rgba(255,255,255,0.09);
  background:rgba(255,255,255,0.06);
}
.hd-chip-icon{font-size:20px;flex-shrink:0;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));}
.hd-chip-val{font-size:17px;font-weight:800;line-height:1.1;letter-spacing:-.3px;}
.hd-chip-lbl{font-size:10px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:.5px;margin-top:1px;}

/* ═══ 3D KPI CARDS ═══ */
.kpi-3d{
  transition:transform .25s cubic-bezier(0.2,0.9,0.2,1),box-shadow .25s ease;
  cursor:default;transform-style:preserve-3d;position:relative;overflow:hidden;
}
.kpi-3d::before{
  content:'';position:absolute;top:0;left:0;right:0;height:50%;
  background:linear-gradient(180deg,rgba(255,255,255,0.045) 0%,transparent 100%);
  border-radius:12px 12px 0 0;pointer-events:none;z-index:0;
}
.kpi-3d:hover{
  transform:perspective(500px) translateZ(14px) translateY(-5px);
  box-shadow:0 20px 48px rgba(0,0,0,0.12),0 8px 20px rgba(0,0,0,0.07);
}

/* 3D KPI icon */
.kpi-icon-wrap{
  width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;
  background:color-mix(in srgb,var(--kc) 12%,transparent);
  border:1px solid color-mix(in srgb,var(--kc) 20%,transparent);
  box-shadow:0 4px 12px rgba(0,0,0,0.1),inset 0 1px 0 rgba(255,255,255,0.5);
  margin-bottom:10px;transition:transform .3s ease,box-shadow .3s ease;transform-style:preserve-3d;
}
.kpi-3d:hover .kpi-icon-wrap{
  transform:perspective(200px) translateZ(6px) scale(1.08);
  box-shadow:0 8px 20px rgba(0,0,0,0.14),inset 0 1px 0 rgba(255,255,255,0.6);
}
.kpi-icon-inner{display:block;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.15));}
`;
