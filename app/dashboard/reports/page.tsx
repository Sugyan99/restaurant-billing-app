"use client";
import { useState, useEffect } from "react";

type Report = {
  totalRevenue: number; totalOrders: number; avgOrderValue: number; totalTax: number;
  paymentBreakdown: Record<string, number>;
  topItems: { name: string; quantity: number; revenue: number }[];
  categorySales: { name: string; revenue: number }[];
};

const PERIODS = [
  { key: "today",     label: "Today"      },
  { key: "yesterday", label: "Yesterday"  },
  { key: "week",      label: "Last 7 Days"},
  { key: "month",     label: "This Month" },
  { key: "custom",    label: "Custom"     },
] as const;

type Period = typeof PERIODS[number]["key"];

export default function ReportsPage() {
  const [report, setReport]   = useState<Report | null>(null);
  const [period, setPeriod]   = useState<Period>("today");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [fromDate, setFromDate]   = useState("");
  const [toDate, setToDate]       = useState(new Date().toISOString().slice(0, 10));

  function buildUrl(exp = false) {
    if (period === "custom" && fromDate) {
      return `/api/reports?from=${fromDate}&to=${toDate}${exp ? "&export=csv" : ""}`;
    }
    return `/api/reports?type=${period}${exp ? "&export=csv" : ""}`;
  }

  useEffect(() => {
    if (period === "custom" && !fromDate) return;
    setLoading(true);
    fetch(buildUrl()).then(r => r.json()).then(d => { setReport(d); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, fromDate, toDate]);

  async function exportCsv() {
    if (period === "custom" && !fromDate) return;
    setExporting(true);
    const res = await fetch(buildUrl(true));
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `sales-report-${period}.csv`; a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  const maxRevenue    = Math.max(...(report?.topItems?.map(i => i.revenue) ?? [1]));
  const maxCatRev     = Math.max(...(report?.categorySales?.map(c => c.revenue) ?? [1]));
  const totalPayments = Object.values(report?.paymentBreakdown ?? {}).reduce((s, v) => s + v, 0);

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20, alignItems: "center" }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`btn ${period === p.key ? "btn-primary" : "btn-ghost"}`}>{p.label}</button>
        ))}
        {period === "custom" && (
          <>
            <input className="input" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ width: 150 }} />
            <span style={{ color: "#94A3B8" }}>→</span>
            <input className="input" type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ width: 150 }} />
          </>
        )}
        <button className="btn btn-ghost" onClick={exportCsv} disabled={exporting} style={{ marginLeft: "auto" }}>
          {exporting ? "Exporting…" : "📥 Export CSV"}
        </button>
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 20 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 100 }} />)}
        </div>
      ) : !report ? null : (
        <>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
            {[
              { label: "Revenue",       value: `₹${report.totalRevenue.toLocaleString("en-IN")}`, icon: "💰", color: "#16A34A" },
              { label: "Orders",        value: report.totalOrders,                                 icon: "🧾", color: "#2563EB" },
              { label: "Avg Order",     value: `₹${report.avgOrderValue.toLocaleString("en-IN")}`, icon: "📊", color: "#7C3AED" },
              { label: "Tax Collected", value: `₹${report.totalTax.toLocaleString("en-IN")}`,      icon: "🏛️", color: "#D97706" },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: 20 }}>
                <div style={{ fontSize: 24 }}>{s.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "#64748B" }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            {/* Payment Breakdown */}
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Payment Breakdown</h3>
              {Object.entries(report.paymentBreakdown).map(([mode, amount]) => (
                <div key={mode} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span>{mode}</span>
                    <span style={{ fontWeight: 700 }}>₹{amount.toLocaleString("en-IN")} ({totalPayments > 0 ? ((amount / totalPayments) * 100).toFixed(1) : 0}%)</span>
                  </div>
                  <div style={{ height: 8, background: "#F1F5F9", borderRadius: 4 }}>
                    <div style={{ height: "100%", borderRadius: 4, background: "var(--primary)", width: `${totalPayments > 0 ? (amount / totalPayments) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Category Sales */}
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Category Revenue</h3>
              {report.categorySales.sort((a, b) => b.revenue - a.revenue).map(c => (
                <div key={c.name} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span>{c.name}</span>
                    <span style={{ fontWeight: 700 }}>₹{c.revenue.toLocaleString("en-IN")}</span>
                  </div>
                  <div style={{ height: 8, background: "#F1F5F9", borderRadius: 4 }}>
                    <div style={{ height: "100%", borderRadius: 4, background: "#7C3AED", width: `${(c.revenue / maxCatRev) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Items */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Top Selling Items</h3>
            {report.topItems.map((item, i) => (
              <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: i < 3 ? "#FEF3C7" : "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {i < 3 ? ["🥇","🥈","🥉"][i] : i + 1}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600 }}>{item.name}</span>
                    <span style={{ color: "#64748B" }}>{item.quantity} sold · ₹{item.revenue.toLocaleString("en-IN")}</span>
                  </div>
                  <div style={{ height: 6, background: "#F1F5F9", borderRadius: 4 }}>
                    <div style={{ height: "100%", borderRadius: 4, background: "linear-gradient(90deg,#16A34A,#4ADE80)", width: `${(item.revenue / maxRevenue) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
