"use client";
import { useState, useEffect } from "react";

type Report = {
  totalRevenue: number; totalOrders: number; totalTax: number; avgOrderValue: number;
  paymentBreakdown: Record<string, number>;
  topItems: { name: string; quantity: number; revenue: number }[];
  categorySales: { name: string; revenue: number }[];
};

export default function ReportsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports?type=${period}`)
      .then((r) => r.json())
      .then((d) => { setReport(d); setLoading(false); });
  }, [period]);

  if (loading) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
      <p>Loading report...</p>
    </div>
  );

  if (!report) return null;

  const maxRevenue = Math.max(...report.topItems.map((i) => i.revenue), 1);

  return (
    <div>
      {/* Period selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {(["today", "week", "month"] as const).map((p) => (
          <button key={p} className={`btn ${period === p ? "btn-primary" : "btn-ghost"}`} onClick={() => setPeriod(p)}>
            {p === "today" ? "Today" : p === "week" ? "Last 7 Days" : "This Month"}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Revenue</div>
          <div className="stat-value" style={{ color: "#16A34A" }}>₹{report.totalRevenue.toFixed(0)}</div>
          <div className="stat-sub">incl. GST</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Orders</div>
          <div className="stat-value">{report.totalOrders}</div>
          <div className="stat-sub">completed & paid</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Order Value</div>
          <div className="stat-value">₹{report.avgOrderValue.toFixed(0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Tax Collected</div>
          <div className="stat-value" style={{ fontSize: 22 }}>₹{report.totalTax.toFixed(0)}</div>
          <div className="stat-sub">CGST + SGST</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 4 }}>
        {/* Top Items */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">🏆 Top Selling Items</h3></div>
          <div className="card-body">
            {report.topItems.length === 0 ? (
              <p style={{ color: "#94A3B8", fontSize: 13 }}>No sales data for this period</p>
            ) : (
              report.topItems.map((item, idx) => (
                <div key={item.name} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>
                      <span style={{ color: "#E8721C", fontWeight: 800, marginRight: 6 }}>#{idx + 1}</span>
                      {item.name}
                    </span>
                    <span style={{ color: "#64748B" }}>{item.quantity} sold · ₹{item.revenue.toFixed(0)}</span>
                  </div>
                  <div style={{ background: "#F1F5F9", borderRadius: 4, height: 6 }}>
                    <div style={{ background: "#E8721C", borderRadius: 4, height: 6, width: `${(item.revenue / maxRevenue) * 100}%`, transition: "width 0.5s" }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Payment Breakdown */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">💳 Payment Breakdown</h3></div>
          <div className="card-body">
            {Object.keys(report.paymentBreakdown).length === 0 ? (
              <p style={{ color: "#94A3B8", fontSize: 13 }}>No payment data for this period</p>
            ) : (
              Object.entries(report.paymentBreakdown).map(([mode, amount]) => (
                <div key={mode} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #F1F5F9" }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {mode === "CASH" ? "💵 Cash" : mode === "UPI" ? "📱 UPI" : mode === "CARD" ? "💳 Card" : "📝 Credit"}
                  </span>
                  <span style={{ fontWeight: 700, color: "#E8721C" }}>₹{(amount as number).toFixed(2)}</span>
                </div>
              ))
            )}
          </div>

          {/* Category breakdown */}
          <div className="card-header" style={{ borderTop: "1px solid #E2E8F0" }}>
            <h3 className="card-title">📂 Category Revenue</h3>
          </div>
          <div className="card-body">
            {report.categorySales.length === 0 ? (
              <p style={{ color: "#94A3B8", fontSize: 13 }}>No category data for this period</p>
            ) : (
              report.categorySales.map((cat) => (
                <div key={cat.name} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F1F5F9", fontSize: 13 }}>
                  <span>{cat.name}</span>
                  <span style={{ fontWeight: 700 }}>₹{cat.revenue.toFixed(2)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
