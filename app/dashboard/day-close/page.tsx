"use client";
import { useState, useEffect } from "react";
import { showToast } from "@/components/Toast";

type Summary = {
  totalSales: number; totalOrders: number; totalExpenses: number; netProfit: number;
  cashSales: number; upiSales: number; cardSales: number; creditSales: number;
  openingCash: number; expectedClosingCash: number;
};

export default function DayClosePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isClosed, setIsClosed] = useState(false);
  const [closingCash, setClosingCash] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/day-close").then(r => r.json()).then(d => {
      setSummary(d.summary);
      setIsClosed(d.isClosed);
      if (d.summary) setClosingCash(d.summary.expectedClosingCash.toFixed(2));
    });
  }, []);

  async function closeDay() {
    if (!closingCash) { showToast("Enter closing cash amount", "error"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/day-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closingCash: parseFloat(closingCash), notes }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast("Day closed successfully!");
      setIsClosed(true);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }

  if (!summary) return <div style={{ padding: 40, color: "#94A3B8" }}>Loading...</div>;

  const cashDiff = parseFloat(closingCash || "0") - summary.expectedClosingCash;

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Day Close</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        {isClosed && (
          <span style={{ background: "#F0FDF4", color: "#16A34A", padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
            ✓ Day Closed
          </span>
        )}
      </div>

      {/* Sales Summary */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-label">Total Sales</div>
          <div className="stat-value" style={{ color: "#16A34A" }}>₹{summary.totalSales.toFixed(2)}</div>
          <div className="stat-sub">{summary.totalOrders} orders</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Expenses</div>
          <div className="stat-value" style={{ color: "#DC2626" }}>₹{summary.totalExpenses.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Net Profit</div>
          <div className="stat-value" style={{ color: summary.netProfit >= 0 ? "#16A34A" : "#DC2626" }}>
            ₹{summary.netProfit.toFixed(2)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cash in Drawer</div>
          <div className="stat-value">₹{summary.expectedClosingCash.toFixed(2)}</div>
          <div className="stat-sub">Opening ₹{summary.openingCash.toFixed(2)} + Cash sales</div>
        </div>
      </div>

      {/* Payment breakdown */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h3 className="card-title">Payment Breakdown</h3></div>
        <div className="card-body">
          {[
            ["💵 Cash", summary.cashSales],
            ["📱 UPI", summary.upiSales],
            ["💳 Card", summary.cardSales],
            ["📝 Credit", summary.creditSales],
          ].map(([label, amount]) => (
            <div key={label as string} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F1F5F9", fontSize: 14 }}>
              <span>{label as string}</span>
              <span style={{ fontWeight: 700 }}>₹{(amount as number).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cash reconciliation */}
      {!isClosed && (
        <div className="card">
          <div className="card-header"><h3 className="card-title">Cash Reconciliation</h3></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Actual Closing Cash (₹) *</label>
              <input className="form-input" type="number" step="0.01" value={closingCash}
                onChange={e => setClosingCash(e.target.value)} placeholder="Count and enter cash in drawer" />
              {closingCash && (
                <div style={{ marginTop: 6, fontSize: 13, color: cashDiff === 0 ? "#16A34A" : Math.abs(cashDiff) < 10 ? "#D97706" : "#DC2626", fontWeight: 600 }}>
                  {cashDiff === 0 ? "✓ Cash matches perfectly" :
                    cashDiff > 0 ? `↑ Excess: ₹${cashDiff.toFixed(2)}` :
                      `↓ Short: ₹${Math.abs(cashDiff).toFixed(2)}`}
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" placeholder="Any remarks for today..." value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", padding: 12 }}
              onClick={closeDay} disabled={loading}>
              {loading ? "Closing..." : "✓ Close Today's Business"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
