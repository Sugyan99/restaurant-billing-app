"use client";
import { useState, useEffect } from "react";
import { showToast } from "@/components/Toast";

type Staff = {
  id: string; name: string; role: string; email: string; salary: number;
  totalOrders: number; paidOrders: number; revenue: number;
  laborCost: number; laborPct: number | null;
};
const ROLE_ICONS: Record<string, string> = { OWNER: "👑", MANAGER: "🏪", CASHIER: "💳", KITCHEN: "👨‍🍳" };

export default function StaffReportPage() {
  const [stats, setStats] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [editId, setEditId] = useState<string | null>(null);
  const [editSalary, setEditSalary] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/staff-report?days=${days}`).then(r => r.json()).then(d => { setStats(d.stats ?? []); setLoading(false); });
  }, [days]);

  async function saveSalary(id: string) {
    setSaving(true);
    const r = await fetch("/api/staff-report", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id, salary: parseFloat(editSalary) }),
    });
    setSaving(false);
    if (r.ok) { showToast("Salary updated"); setEditId(null); fetch(`/api/staff-report?days=${days}`).then(r => r.json()).then(d => setStats(d.stats ?? [])); }
    else showToast("Failed", "error");
  }

  const maxRev   = Math.max(...stats.map(s => s.revenue), 1);
  const totalRev = stats.reduce((s, x) => s + x.revenue, 0);
  const totalLabor = stats.reduce((s, x) => s + x.laborCost, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Staff Performance</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>Revenue, orders, and labor cost per staff member</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[7, 15, 30].map(d => (
            <button key={d} className={`btn btn-sm ${days === d ? "btn-primary" : "btn-ghost"}`} onClick={() => setDays(d)}>{d} days</button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 20 }}>💰</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#16A34A" }}>₹{totalRev.toLocaleString("en-IN")}</div>
          <div style={{ fontSize: 12, color: "#64748B" }}>Total Revenue ({days}d)</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 20 }}>💼</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#DC2626" }}>₹{totalLabor.toLocaleString("en-IN")}</div>
          <div style={{ fontSize: 12, color: "#64748B" }}>Total Labor Cost ({days}d)</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 20 }}>📊</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#D97706" }}>
            {totalRev > 0 ? ((totalLabor / totalRev) * 100).toFixed(1) : 0}%
          </div>
          <div style={{ fontSize: 12, color: "#64748B" }}>Labor Cost %</div>
        </div>
      </div>

      {stats.length === 0 ? (
        loading
          ? <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 100 }} />)}</div>
          : <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}><div style={{ fontSize: 40 }}>📊</div><p>No data</p></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {stats.map((s, i) => (
            <div key={s.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, position: "relative" }}>
                    {ROLE_ICONS[s.role]}
                    {i === 0 && <span style={{ position: "absolute", top: -4, right: -4, fontSize: 12 }}>🏆</span>}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: "#64748B" }}>{s.role} · {s.email}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 20, textAlign: "right" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: "#16A34A" }}>₹{s.revenue.toLocaleString("en-IN")}</div>
                    <div style={{ fontSize: 11, color: "#64748B" }}>Revenue</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{s.paidOrders}/{s.totalOrders}</div>
                    <div style={{ fontSize: 11, color: "#64748B" }}>Paid/Total</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#DC2626" }}>₹{s.laborCost.toLocaleString("en-IN")}</div>
                    <div style={{ fontSize: 11, color: "#64748B" }}>Labor Cost</div>
                  </div>
                  {s.laborPct !== null && (
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: s.laborPct > 30 ? "#DC2626" : s.laborPct > 20 ? "#D97706" : "#16A34A" }}>{s.laborPct}%</div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>Labor %</div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ height: 8, background: "#F1F5F9", borderRadius: 4, marginBottom: 10 }}>
                <div style={{ height: "100%", borderRadius: 4, background: "linear-gradient(90deg,var(--primary),#818CF8)", width: `${(s.revenue / maxRev) * 100}%` }} />
              </div>

              {/* Salary edit */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 12, color: "#64748B" }}>Monthly Salary:</span>
                {editId === s.id ? (
                  <>
                    <input className="input" type="number" value={editSalary} onChange={e => setEditSalary(e.target.value)} style={{ width: 120, fontSize: 13, padding: "4px 8px" }} placeholder="₹" />
                    <button className="btn btn-sm btn-primary" onClick={() => saveSalary(s.id)} disabled={saving}>{saving ? "…" : "Save"}</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setEditId(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>₹{(s.salary ?? 0).toLocaleString("en-IN")}/mo</span>
                    <button className="btn btn-sm btn-ghost" style={{ fontSize: 11 }} onClick={() => { setEditId(s.id); setEditSalary(String(s.salary ?? 0)); }}>Edit</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
