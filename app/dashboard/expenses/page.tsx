"use client";
import { useState, useEffect, useCallback } from "react";
import { showToast } from "@/components/Toast";

type Expense = { id: string; description: string; amount: number; category: string; date: string };

const CATEGORIES = ["INGREDIENTS", "UTILITIES", "SALARIES", "MAINTENANCE", "MARKETING", "OTHER"];
const CAT_ICONS: Record<string, string> = {
  INGREDIENTS: "🛒", UTILITIES: "💡", SALARIES: "👥",
  MAINTENANCE: "🔧", MARKETING: "📢", OTHER: "📌",
};
const CAT_COLORS: Record<string, string> = {
  INGREDIENTS: "#16A34A", UTILITIES: "#2563EB", SALARIES: "#7C3AED",
  MAINTENANCE: "#D97706", MARKETING: "#EC4899", OTHER: "#64748B",
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState({ description: "", amount: "", category: "INGREDIENTS" });
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/expenses?date=${date}`);
    const data = await res.json();
    setExpenses(data.expenses ?? []);
    setTotal(data.total ?? 0);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  async function addExpense() {
    if (!form.description.trim()) { showToast("Description is required", "error"); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { showToast("Valid amount is required", "error"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: form.description, amount: parseFloat(form.amount), category: form.category, date }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast("Expense added!");
      setForm({ description: "", amount: "", category: "INGREDIENTS" });
      await load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }

  // Category breakdown
  const breakdown = CATEGORIES.map(cat => ({
    cat,
    total: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter(b => b.total > 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Expense Tracking</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>Total today: ₹{total.toFixed(2)}</p>
        </div>
        <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} style={{ width: 160 }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
        {/* Left: list */}
        <div>
          {expenses.length === 0 ? (
            <div className="card" style={{ padding: "40px 0", textAlign: "center", color: "#94A3B8" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
              <p>No expenses recorded for this date</p>
            </div>
          ) : (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Expenses</h3>
                <span style={{ fontWeight: 700, color: "#DC2626" }}>₹{total.toFixed(2)}</span>
              </div>
              {expenses.map(exp => (
                <div key={exp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid #F1F5F9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{CAT_ICONS[exp.category]}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{exp.description}</div>
                      <div style={{ fontSize: 11, color: CAT_COLORS[exp.category], fontWeight: 600 }}>{exp.category}</div>
                    </div>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 15, color: "#DC2626" }}>₹{exp.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: add form + breakdown */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-header"><h3 className="card-title">Add Expense</h3></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{CAT_ICONS[c]} {c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Description *</label>
                <input className="form-input" placeholder="e.g. Vegetables purchase" value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Amount (₹) *</label>
                <input className="form-input" type="number" placeholder="0.00" value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
              <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}
                onClick={addExpense} disabled={loading}>
                {loading ? "Adding..." : "Add Expense"}
              </button>
            </div>
          </div>

          {breakdown.length > 0 && (
            <div className="card">
              <div className="card-header"><h3 className="card-title">By Category</h3></div>
              <div className="card-body">
                {breakdown.map(b => (
                  <div key={b.cat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 13 }}>{CAT_ICONS[b.cat]} {b.cat}</span>
                    <span style={{ fontWeight: 700, color: CAT_COLORS[b.cat] }}>₹{b.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
