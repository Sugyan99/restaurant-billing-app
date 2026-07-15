"use client";
import { useState, useEffect } from "react";

type Staff = { id: string; name: string; role: string; email: string; totalOrders: number; paidOrders: number; revenue: number };
const ROLE_ICONS: Record<string, string> = { OWNER: "👑", MANAGER: "🏪", CASHIER: "💳", KITCHEN: "👨‍🍳" };

export default function StaffReportPage() {
  const [stats, setStats] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetch(`/api/staff-report?days=${days}`).then(r => r.json()).then(d => { setStats(d.stats ?? []); setLoading(false); });
  }, [days]);

  const maxRev = Math.max(...stats.map(s => s.revenue), 1);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div><h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Staff Performance</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>Revenue and orders per staff member</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[7, 15, 30].map(d => (
            <button key={d} className={`btn btn-sm ${days === d ? "btn-primary" : "btn-ghost"}`} onClick={() => setDays(d)}>
              {d} days
            </button>
          ))}
        </div>
      </div>

      {stats.length === 0 ? (
        loading ? <div style={{display:"flex",flexDirection:"column",gap:12}}>{[1,2,3].map(i=><div key={i} className="skeleton" style={{height:80}}/>)}</div> :
      <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <p>No staff data available</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {stats.map((s, i) => (
            <div key={s.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
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
                <div style={{ display: "flex", gap: 24, textAlign: "right" }}>
                  <div><div style={{ fontSize: 11, color: "#94A3B8" }}>Orders</div><div style={{ fontWeight: 800, fontSize: 18 }}>{s.totalOrders}</div></div>
                  <div><div style={{ fontSize: 11, color: "#94A3B8" }}>Revenue</div><div style={{ fontWeight: 800, fontSize: 18, color: "#16A34A" }}>₹{s.revenue.toFixed(0)}</div></div>
                </div>
              </div>
              <div style={{ background: "#F1F5F9", borderRadius: 6, height: 8 }}>
                <div style={{ background: "linear-gradient(90deg, #E8721C, #FDBA74)", borderRadius: 6, height: 8, width: `${(s.revenue / maxRev) * 100}%`, transition: "width 0.5s" }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
