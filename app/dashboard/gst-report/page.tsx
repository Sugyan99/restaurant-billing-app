"use client";
import { useState, useEffect } from "react";

type GSTData = {
  month: number; year: number; gstin: string | null; restaurantName: string;
  summary: { totalBills: number; totalTaxable: number; totalCgst: number; totalSgst: number; totalTax: number; totalRevenue: number };
  daily: { date: string; taxable: number; cgst: number; sgst: number; total: number; bills: number }[];
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function GSTReportPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<GSTData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/gst-report?month=${month}&year=${year}`)
      .then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, [month, year]);

  function printReport() {
    window.print();
  }

  if (loading) return <div style={{ padding: 40, color: "#94A3B8" }}>Loading GST report...</div>;
  if (!data) return null;

  const { summary } = data;

  return (
    <div>
      {/* Controls */}
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>GST Report</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>For tax filing — GSTR-1</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select className="form-select" style={{ width: 110 }} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select className="form-select" style={{ width: 90 }} value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn btn-primary" onClick={printReport}>🖨️ Print</button>
        </div>
      </div>

      {/* Header for print */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{data.restaurantName}</h3>
        <p style={{ margin: "2px 0", fontSize: 13, color: "#64748B" }}>
          GSTIN: {data.gstin ?? "Not set — add in Settings"}
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>
          Period: {MONTHS[month - 1]} {year}
        </p>
      </div>

      {/* Summary cards */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        {[
          ["Total Bills", summary.totalBills, "#374151", ""],
          ["Taxable Value", summary.totalTaxable, "#2563EB", "₹"],
          ["CGST Collected", summary.totalCgst, "#D97706", "₹"],
          ["SGST Collected", summary.totalSgst, "#D97706", "₹"],
          ["Total Tax", summary.totalTax, "#DC2626", "₹"],
          ["Total Revenue", summary.totalRevenue, "#16A34A", "₹"],
        ].map(([label, val, color, prefix]) => (
          <div key={label as string} className="stat-card">
            <div className="stat-label">{label as string}</div>
            <div className="stat-value" style={{ color: color as string, fontSize: 20 }}>
              {prefix}{typeof val === "number" ? val.toFixed(2) : val}
            </div>
          </div>
        ))}
      </div>

      {/* Daily breakdown */}
      <div className="card">
        <div className="card-header"><h3 className="card-title">Daily Breakdown</h3></div>
        {data.daily.length === 0 ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "#94A3B8" }}>No bills for this period</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                  {["Date", "Bills", "Taxable (₹)", "CGST (₹)", "SGST (₹)", "Total Tax (₹)", "Revenue (₹)"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#64748B" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.daily.map(d => (
                  <tr key={d.date} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "10px 16px", fontWeight: 600 }}>
                      {new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </td>
                    {[d.bills, d.taxable.toFixed(2), d.cgst.toFixed(2), d.sgst.toFixed(2), (d.cgst + d.sgst).toFixed(2), d.total.toFixed(2)].map((v, i) => (
                      <td key={i} style={{ padding: "10px 16px", textAlign: "right" }}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#F8FAFC", borderTop: "2px solid #E2E8F0", fontWeight: 800 }}>
                  <td style={{ padding: "10px 16px" }}>TOTAL</td>
                  <td style={{ padding: "10px 16px", textAlign: "right" }}>{summary.totalBills}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right" }}>{summary.totalTaxable.toFixed(2)}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right" }}>{summary.totalCgst.toFixed(2)}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right" }}>{summary.totalSgst.toFixed(2)}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", color: "#DC2626" }}>{summary.totalTax.toFixed(2)}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", color: "#16A34A" }}>{summary.totalRevenue.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
