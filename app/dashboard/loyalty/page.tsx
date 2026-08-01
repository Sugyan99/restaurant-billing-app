"use client";
import { useState, useEffect, useCallback } from "react";
import { showToast } from "@/components/Toast";

type Customer = { id: string; name: string; phone: string; loyaltyPoints: number; totalSpent: number; totalVisits: number; tier: { name: string; color: string } };

const TIER_ICON: Record<string, string> = { Gold: "🥇", Silver: "🥈", Bronze: "🥉" };

export default function LoyaltyPage() {
  const [customers, setCustomers]   = useState<Customer[]>([]);
  const [loading, setLoading]       = useState(true);
  const [searchPhone, setSearchPhone] = useState("");
  const [searched, setSearched]     = useState<Customer | null>(null);
  const [searchErr, setSearchErr]   = useState("");
  const [busy, setBusy]             = useState(false);

  // Redeem state
  const [redeemPhone, setRedeemPhone] = useState("");
  const [redeemPts, setRedeemPts]     = useState(0);
  const [redeemResult, setRedeemResult] = useState<{ discount: number; remainingPoints: number } | null>(null);

  // Add points state
  const [addPhone, setAddPhone]     = useState("");
  const [addPts, setAddPts]         = useState(0);
  const [addReason, setAddReason]   = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/loyalty");
    const d   = await res.json();
    setCustomers(d.customers ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function searchCustomer() {
    if (!searchPhone.trim()) return;
    setSearchErr(""); setSearched(null);
    const res = await fetch(`/api/loyalty?phone=${encodeURIComponent(searchPhone.trim())}`);
    const d   = await res.json();
    if (!res.ok) { setSearchErr(d.error); return; }
    setSearched(d.customer);
  }

  async function redeem() {
    if (!redeemPhone || redeemPts <= 0) { showToast("Enter phone and points", "error"); return; }
    setBusy(true); setRedeemResult(null);
    const res = await fetch("/api/loyalty", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: redeemPhone, points: redeemPts }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) { showToast(d.error, "error"); return; }
    setRedeemResult(d);
    showToast(d.message);
    load();
  }

  async function addPoints() {
    if (!addPhone || addPts <= 0) { showToast("Enter phone and points", "error"); return; }
    setBusy(true);
    const res = await fetch("/api/loyalty", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: addPhone, points: addPts, reason: addReason }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) { showToast(d.error, "error"); return; }
    showToast(`Added ${d.added} pts → Balance: ${d.loyaltyPoints} pts`);
    setAddPhone(""); setAddPts(0); setAddReason("");
    load();
  }

  const gold   = customers.filter(c => c.tier.name === "Gold").length;
  const silver = customers.filter(c => c.tier.name === "Silver").length;
  const totalPts = customers.reduce((s, c) => s + c.loyaltyPoints, 0);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Loyalty Program</h2>
        <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>100 pts = ₹10 · Earn 1 pt per ₹1 spent</p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: 24 }}>
        {[
          ["Members", customers.length, "#6366F1"],
          ["🥇 Gold", gold, "#F59E0B"],
          ["🥈 Silver", silver, "#94A3B8"],
          ["Total Points", totalPts.toLocaleString(), "#16A34A"],
        ].map(([label, val, color]) => (
          <div key={label as string} className="card" style={{ padding: "12px 16px", borderLeft: `3px solid ${color}` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: color as string }}>{val}</div>
            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Redeem */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">🎁 Redeem Points</h3></div>
          <div style={{ padding: "0 20px 20px" }}>
            <label style={LBL}>Customer Phone</label>
            <input value={redeemPhone} onChange={e => setRedeemPhone(e.target.value)} placeholder="10-digit mobile" style={INP} />
            <label style={LBL}>Points to Redeem</label>
            <input type="number" value={redeemPts || ""} onChange={e => setRedeemPts(parseInt(e.target.value) || 0)} min={1} placeholder="e.g. 100" style={INP} />
            {redeemPts > 0 && (
              <p style={{ fontSize: 12, color: "#16A34A", margin: "4px 0 10px", fontWeight: 600 }}>
                = ₹{(redeemPts * 0.1).toFixed(2)} discount
              </p>
            )}
            {redeemResult && (
              <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 13 }}>
                ✅ ₹{redeemResult.discount} applied · {redeemResult.remainingPoints} pts remaining
              </div>
            )}
            <button className="btn btn-primary" onClick={redeem} disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
              Redeem
            </button>
          </div>
        </div>

        {/* Add points */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">➕ Add Points</h3></div>
          <div style={{ padding: "0 20px 20px" }}>
            <label style={LBL}>Customer Phone</label>
            <input value={addPhone} onChange={e => setAddPhone(e.target.value)} placeholder="10-digit mobile" style={INP} />
            <label style={LBL}>Points to Add</label>
            <input type="number" value={addPts || ""} onChange={e => setAddPts(parseInt(e.target.value) || 0)} min={1} placeholder="e.g. 50" style={INP} />
            <label style={LBL}>Reason</label>
            <input value={addReason} onChange={e => setAddReason(e.target.value)} placeholder="e.g. Birthday bonus" style={INP} />
            <button className="btn btn-primary" onClick={addPoints} disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
              Add Points
            </button>
          </div>
        </div>
      </div>

      {/* Customer search */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><h3 className="card-title">🔍 Customer Lookup</h3></div>
        <div style={{ padding: "0 20px 20px" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={searchPhone} onChange={e => setSearchPhone(e.target.value)}
              onKeyDown={e => e.key === "Enter" && searchCustomer()}
              placeholder="Enter phone number…" style={{ ...INP, flex: 1 }} />
            <button className="btn btn-primary" onClick={searchCustomer}>Search</button>
          </div>
          {searchErr && <p style={{ color: "#DC2626", fontSize: 13, margin: "8px 0 0" }}>⚠ {searchErr}</p>}
          {searched && (
            <div style={{ marginTop: 14, background: "#F8FAFC", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{searched.name}</div>
                  <div style={{ color: "#64748B", fontSize: 13 }}>{searched.phone}</div>
                  <div style={{ color: "#64748B", fontSize: 12, marginTop: 4 }}>
                    {searched.totalVisits} visits · ₹{searched.totalSpent.toFixed(2)} spent
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: searched.tier.color, fontWeight: 700 }}>
                    {TIER_ICON[searched.tier.name]} {searched.tier.name}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#6366F1" }}>{searched.loyaltyPoints}</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>points</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="card">
        <div className="card-header"><h3 className="card-title">🏆 Top Members</h3></div>
        {loading ? <p style={{ padding: "20px", color: "#94A3B8" }}>Loading…</p>
          : customers.length === 0 ? (
            <p style={{ padding: "40px 20px", textAlign: "center", color: "#94A3B8" }}>No loyalty members yet</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                    {["#", "Name", "Phone", "Tier", "Points", "Value", "Visits"].map(h => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c, i) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "10px 16px", color: "#94A3B8", fontWeight: 700 }}>{i + 1}</td>
                      <td style={{ padding: "10px 16px", fontWeight: 600 }}>{c.name}</td>
                      <td style={{ padding: "10px 16px", color: "#64748B" }}>{c.phone}</td>
                      <td style={{ padding: "10px 16px" }}>
                        <span style={{ color: c.tier.color, fontWeight: 700, fontSize: 12 }}>
                          {TIER_ICON[c.tier.name]} {c.tier.name}
                        </span>
                      </td>
                      <td style={{ padding: "10px 16px", fontWeight: 800, color: "#6366F1" }}>{c.loyaltyPoints.toLocaleString()}</td>
                      <td style={{ padding: "10px 16px", color: "#16A34A", fontWeight: 600 }}>₹{(c.loyaltyPoints * 0.1).toFixed(0)}</td>
                      <td style={{ padding: "10px 16px", color: "#64748B" }}>{c.totalVisits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}

const LBL: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 5, marginTop: 10, textTransform: "uppercase", letterSpacing: .4 };
const INP: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
