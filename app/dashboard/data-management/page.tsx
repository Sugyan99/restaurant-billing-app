"use client";
import { useState, useEffect, useCallback } from "react";
import { showToast } from "@/components/Toast";

type Counts = { orders: number; bills: number; expenses: number; customers: number; reservations: number; dayCloses: number };

const ACTIONS = [
  { type: "orders", label: "Served/Cancelled Orders + Bills", icon: "📋", color: "#E8721C", warning: "This will also delete associated bills. Cannot be undone." },
  { type: "expenses", label: "Expense Records", icon: "💰", color: "#DC2626", warning: "Deleted expenses won't appear in P&L reports." },
  { type: "reservations", label: "Cancelled/No-Show Reservations", icon: "📅", color: "#D97706", warning: "Only cancelled and no-show reservations will be deleted." },
  { type: "dayCloses", label: "Day Close Records", icon: "🔒", color: "#64748B", warning: "Historical day close records will be removed." },
];

export default function DataManagementPage() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [before, setBefore] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/data-management");
    const d = await res.json();
    setCounts(d.counts);
    setPageLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteData(type: string) {
    if (!before) { showToast("Select a date first", "error"); return; }
    setDeleting(type);
    try {
      const res = await fetch("/api/data-management", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, before }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showToast(`${d.deleted} ${type} records deleted`);
      setConfirm(null);
      await load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed", "error");
    } finally { setDeleting(null); }
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Data Management</h2>
        <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>Owner-only: delete old records to keep database clean</p>
      </div>

      {/* Current counts */}
      {counts && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><h3 className="card-title">📊 Database Overview</h3></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0 }}>
            {[
              ["Orders", counts.orders, "📋"],
              ["Bills", counts.bills, "🧾"],
              ["Expenses", counts.expenses, "💰"],
              ["Customers", counts.customers, "👤"],
              ["Reservations", counts.reservations, "📅"],
              ["Day Closes", counts.dayCloses, "🔒"],
            ].map(([label, count, icon]) => (
              <div key={label as string} style={{ padding: "14px 20px", borderBottom: "1px solid #F1F5F9", borderRight: "1px solid #F1F5F9" }}>
                <div style={{ fontSize: 11, color: "#94A3B8" }}>{icon} {label as string}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#0F1623" }}>{count as number}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete actions */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h3 className="card-title">🗑️ Delete Old Records</h3></div>
        <div className="card-body">
          <div className="form-group">
            <label className="form-label">Delete records older than:</label>
            <input type="date" className="form-input" value={before}
              max={new Date().toISOString().split("T")[0]}
              onChange={e => setBefore(e.target.value)}
              style={{ maxWidth: 200 }}
            />
          </div>
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#DC2626", fontWeight: 500 }}>
            ⚠️ Deletions are permanent and cannot be undone. Always take a backup first.
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ACTIONS.map(action => (
          <div key={action.type} className="card" style={{ padding: 16, borderLeft: `4px solid ${action.color}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{action.icon} {action.label}</div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{action.warning}</div>
              </div>
              {confirm === action.type ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>Cancel</button>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteData(action.type)} disabled={deleting === action.type}>
                    {deleting === action.type ? "Deleting..." : "Yes, Delete"}
                  </button>
                </div>
              ) : (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => { if (!before) { showToast("Select a date first", "error"); return; } setConfirm(action.type); }}
                  disabled={!before}
                >
                  🗑️ Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
