"use client";
import { useState, useEffect } from "react";

type LedgerItem = {
  id: string; name: string; unit: string; currentStock: number; minStock: number;
  costPerUnit: number; isLow: boolean; totalSpentThisMonth: number;
  estimatedStockValue: number;
  expenses: { id: string; description: string; amount: number; date: string }[];
};
type Summary = { totalIngredientCost: number; totalStockValue: number; lowStockCount: number; totalItems: number };

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function StockLedgerPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/stock-ledger?month=${month}&year=${year}`)
      .then(r => r.json()).then(d => { setLedger(d.ledger ?? []); setSummary(d.summary); setLoading(false); });
  }, [month, year]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Stock Ledger</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>Inventory + Ingredient expenses merged</p>
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

      {/* Summary */}
      {summary && (
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          {[
            { label: "Total Items", value: summary.totalItems, color: "#374151", icon: "📦" },
            { label: "Ingredient Cost", value: `₹${summary.totalIngredientCost.toFixed(0)}`, color: "#DC2626", icon: "💸" },
            { label: "Stock Value", value: `₹${summary.totalStockValue.toFixed(0)}`, color: "#2563EB", icon: "💰" },
            { label: "Low Stock", value: summary.lowStockCount, color: summary.lowStockCount > 0 ? "#DC2626" : "#16A34A", icon: "⚠️" },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ borderTop: `3px solid ${s.color}` }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div className="stat-label">{s.label}</div>
                <span style={{ fontSize: 20, opacity: 0.15 }}>{s.icon}</span>
              </div>
              <div className="stat-value" style={{ color: s.color, fontSize: 22 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60 }} />)}
        </div>
      ) : ledger.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
          <p>No inventory items. Add items in the Inventory section.</p>
        </div>
      ) : (
        <div className="card">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                  {["Item", "Stock", "Min", "Cost/Unit", "Stock Value", "Spent This Month", "Status", ""].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ledger.map(item => (
                  <>
                    <tr key={item.id} style={{ borderBottom: "1px solid #F1F5F9", background: item.isLow ? "#FFF5F5" : "white" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 600 }}>{item.name}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 700, color: item.isLow ? "#DC2626" : "#16A34A" }}>
                        {item.currentStock} {item.unit}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#64748B" }}>{item.minStock} {item.unit}</td>
                      <td style={{ padding: "12px 16px" }}>₹{item.costPerUnit.toFixed(2)}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 700, color: "#2563EB" }}>₹{item.estimatedStockValue.toFixed(2)}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 700, color: "#E8721C" }}>
                        {item.totalSpentThisMonth > 0 ? `₹${item.totalSpentThisMonth.toFixed(2)}` : "—"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span className={`badge ${item.isLow ? "badge-cancelled" : "badge-ready"}`}>
                          {item.isLow ? "⚠️ Low" : "✓ OK"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {item.expenses.length > 0 && (
                          <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
                            {expanded === item.id ? "▲" : `▼ ${item.expenses.length} entries`}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded === item.id && item.expenses.map(e => (
                      <tr key={e.id} style={{ background: "#FFFBF7", borderBottom: "1px solid #FEF3C7" }}>
                        <td colSpan={2} style={{ padding: "8px 16px 8px 32px", fontSize: 12, color: "#64748B" }}>↳ {e.description}</td>
                        <td colSpan={2} style={{ padding: "8px 16px", fontSize: 12, color: "#64748B" }}>
                          {new Date(e.date).toLocaleDateString("en-IN")}
                        </td>
                        <td colSpan={3} style={{ padding: "8px 16px", fontSize: 12, fontWeight: 700, color: "#DC2626" }}>₹{e.amount.toFixed(2)}</td>
                        <td />
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
