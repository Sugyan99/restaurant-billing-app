"use client";
import { useState, useEffect } from "react";

type PnL = {
  revenue: number; revenueExTax: number; tax: number;
  totalExpenses: number; grossProfit: number; profitMargin: number;
  totalOrders: number; expenseByCategory: Record<string, number>;
  paymentBreakdown: Record<string, number>;
};
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function PnLPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<PnL | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/pnl?month=${month}&year=${year}`)
      .then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, [month, year]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Profit & Loss</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>Monthly income statement</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select className="form-select" style={{ width: 100 }} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select className="form-select" style={{ width: 90 }} value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm no-print" onClick={() => window.print()}>🖨️ Print</button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 100 }} />)}
        </div>
      ) : !data ? null : (
        <>
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            {[
              { label: "Total Revenue", value: `₹${data.revenue.toFixed(2)}`, color: "#16A34A", sub: `${data.totalOrders} orders` },
              { label: "Total Expenses", value: `₹${data.totalExpenses.toFixed(2)}`, color: "#DC2626", sub: "all categories" },
              { label: "Gross Profit", value: `₹${data.grossProfit.toFixed(2)}`, color: data.grossProfit >= 0 ? "#2563EB" : "#DC2626", sub: `${data.profitMargin}% margin` },
              { label: "Tax Collected", value: `₹${data.tax.toFixed(2)}`, color: "#7C3AED", sub: "CGST + SGST" },
            ].map(s => (
              <div key={s.label} className="stat-card" style={{ borderTop: `3px solid ${s.color}` }}>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color: s.color, fontSize: 20 }}>{s.value}</div>
                <div className="stat-sub">{s.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Income Statement */}
            <div className="card">
              <div className="card-header"><h3 className="card-title">📊 Income Statement</h3></div>
              <div className="card-body">
                {[
                  ["Gross Revenue", data.revenue, false],
                  ["Less: GST", -data.tax, false],
                  ["Net Revenue", data.revenueExTax, false],
                  ["Less: Expenses", -data.totalExpenses, false],
                  ["Net Profit", data.grossProfit, true],
                ].map(([label, val, bold]) => (
                  <div key={label as string} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F1F5F9", fontSize: 13, fontWeight: bold ? 800 : 400 }}>
                    <span style={{ color: bold ? "#0F1623" : "#374151" }}>{label as string}</span>
                    <span style={{ color: (val as number) < 0 ? "#DC2626" : bold ? ((val as number) >= 0 ? "#16A34A" : "#DC2626") : "#374151" }}>
                      {(val as number) < 0 ? `-₹${Math.abs(val as number).toFixed(2)}` : `₹${(val as number).toFixed(2)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Expense breakdown */}
            <div className="card">
              <div className="card-header"><h3 className="card-title">💸 Expense Breakdown</h3></div>
              <div className="card-body">
                {Object.keys(data.expenseByCategory).length === 0
                  ? <p style={{ color: "#94A3B8", fontSize: 13 }}>No expenses this period</p>
                  : Object.entries(data.expenseByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                    <div key={cat} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F1F5F9", fontSize: 13 }}>
                      <span>{cat}</span>
                      <span style={{ fontWeight: 700, color: "#DC2626" }}>₹{amt.toFixed(2)}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
