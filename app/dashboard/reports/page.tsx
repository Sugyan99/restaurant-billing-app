"use client";
import { useState, useEffect } from "react";

type Report = {
  totalRevenue: number; totalOrders: number; avgOrderValue: number; totalTax: number;
  paymentBreakdown: Record<string, number>;
  topItems: { name: string; quantity: number; revenue: number }[];
  categorySales: { name: string; revenue: number }[];
};

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "week", label: "Last 7 Days" },
  { key: "month", label: "This Month" },
] as const;

export default function ReportsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports?type=${period}`)
      .then(r => r.json())
      .then(d => { setReport(d); setLoading(false); });
  }, [period]);

  const maxRevenue = Math.max(...(report?.topItems?.map(i => i.revenue) ?? [1]));
  const totalPayments = Object.values(report?.paymentBreakdown ?? {}).reduce((s, v) => s + v, 0);

  return (
    <div>
      {/* Period Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`btn ${period === p.key ? "btn-primary" : "btn-ghost"}`}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 20 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 100 }} />)}
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            {[
              { label: "Total Revenue", value: `₹${report!.totalRevenue.toFixed(2)}`, color: "#16A34A", icon: "💰" },
              { label: "Total Orders", value: report!.totalOrders, color: "#E8721C", icon: "📋" },
              { label: "Avg Order Value", value: `₹${report!.avgOrderValue.toFixed(2)}`, color: "#2563EB", icon: "🧮" },
              { label: "Tax Collected", value: `₹${report!.totalTax.toFixed(2)}`, color: "#7C3AED", icon: "🧾" },
            ].map(s => (
              <div key={s.label} className="stat-card" style={{ borderTop: `3px solid ${s.color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div className="stat-label">{s.label}</div>
                  <span style={{ fontSize: 20, opacity: 0.2 }}>{s.icon}</span>
                </div>
                <div className="stat-value" style={{ color: s.color, fontSize: 22 }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
            {/* Top Items */}
            <div className="card">
              <div className="card-header"><h3 className="card-title">🏆 Top Selling Items</h3></div>
              <div className="card-body">
                {report!.topItems.length === 0
                  ? <p style={{ color: "#94A3B8", fontSize: 13 }}>No sales data for this period</p>
                  : report!.topItems.map((item, i) => (
                    <div key={item.name} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                        <span style={{ fontWeight: 600 }}>
                          <span style={{ color: i < 3 ? "#E8721C" : "#94A3B8", fontWeight: 800, marginRight: 8 }}>#{i + 1}</span>
                          {item.name}
                        </span>
                        <span style={{ color: "#64748B", fontSize: 12 }}>{item.quantity} sold · <b style={{ color: "#E8721C" }}>₹{item.revenue.toFixed(0)}</b></span>
                      </div>
                      <div style={{ background: "#F1F5F9", borderRadius: 6, height: 8, overflow: "hidden" }}>
                        <div style={{ background: `linear-gradient(90deg, #E8721C, #FDBA74)`, borderRadius: 6, height: 8, width: `${(item.revenue / maxRevenue) * 100}%`, transition: "width 0.6s ease" }} />
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Payment Breakdown */}
              <div className="card">
                <div className="card-header"><h3 className="card-title">💳 Payment Methods</h3></div>
                <div className="card-body">
                  {Object.keys(report!.paymentBreakdown).length === 0
                    ? <p style={{ color: "#94A3B8", fontSize: 13 }}>No payment data</p>
                    : Object.entries(report!.paymentBreakdown).map(([mode, amount]) => {
                      const icons: Record<string, string> = { CASH: "💵", UPI: "📱", CARD: "💳", CREDIT: "📝" };
                      const pct = totalPayments > 0 ? ((amount / totalPayments) * 100).toFixed(0) : 0;
                      return (
                        <div key={mode} style={{ marginBottom: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                            <span style={{ fontWeight: 600 }}>{icons[mode] ?? "💰"} {mode}</span>
                            <span><b>₹{amount.toFixed(0)}</b> <span style={{ color: "#94A3B8", fontSize: 11 }}>{pct}%</span></span>
                          </div>
                          <div style={{ background: "#F1F5F9", borderRadius: 4, height: 5 }}>
                            <div style={{ background: "#E8721C", borderRadius: 4, height: 5, width: `${pct}%`, transition: "width 0.5s" }} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Category Revenue */}
              <div className="card">
                <div className="card-header"><h3 className="card-title">📂 By Category</h3></div>
                <div className="card-body" style={{ padding: "12px 20px" }}>
                  {report!.categorySales.length === 0
                    ? <p style={{ color: "#94A3B8", fontSize: 13 }}>No data</p>
                    : report!.categorySales.sort((a, b) => b.revenue - a.revenue).map(cat => (
                      <div key={cat.name} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #F1F5F9", fontSize: 13 }}>
                        <span>{cat.name}</span>
                        <span style={{ fontWeight: 700, color: "#E8721C" }}>₹{cat.revenue.toFixed(0)}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
