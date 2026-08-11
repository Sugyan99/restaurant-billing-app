"use client";
import { useState, useEffect, useCallback } from "react";
import { showToast } from "@/components/Toast";

type GiftCard = {
  id: string; code: string; initialValue: number; balance: number;
  isActive: boolean; expiresAt?: string; recipientName?: string; recipientPhone?: string;
  purchasedAt: string;
  transactions: { id: string; type: string; amount: number; balanceAfter: number; orderId?: string; createdAt: string }[];
};

const TYPE_COLOR: Record<string, string> = { ISSUE: "#16A34A", REDEEM: "#DC2626", TOPUP: "#2563EB", VOID: "#94A3B8" };

export default function GiftCardsPage() {
  const [cards, setCards]       = useState<GiftCard[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<GiftCard | null>(null);
  const [showNew, setShowNew]   = useState(false);
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // New card form
  const [newVal, setNewVal]     = useState("");
  const [newName, setNewName]   = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newExp, setNewExp]     = useState("");
  const [creating, setCreating] = useState(false);

  // Redeem / topup form
  const [actionType, setActionType] = useState<"REDEEM" | "TOPUP">("REDEEM");
  const [actionAmt, setActionAmt]   = useState("");
  const [acting, setActing]         = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/gift-cards");
    const d = await r.json();
    setCards(d.cards ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createCard() {
    if (!newVal || parseFloat(newVal) <= 0) return showToast("Enter valid amount", "error");
    setCreating(true);
    const r = await fetch("/api/gift-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initialValue: parseFloat(newVal), recipientName: newName || undefined, recipientPhone: newPhone || undefined, expiresAt: newExp || undefined }),
    });
    setCreating(false);
    if (r.ok) { showToast("Gift card created!"); setShowNew(false); setNewVal(""); setNewName(""); setNewPhone(""); setNewExp(""); load(); }
    else showToast("Failed to create", "error");
  }

  async function doAction() {
    if (!selected || !actionAmt || parseFloat(actionAmt) <= 0) return;
    setActing(true);
    const r = await fetch(`/api/gift-cards/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: actionType, amount: parseFloat(actionAmt) }),
    });
    const d = await r.json();
    setActing(false);
    if (r.ok) {
      showToast(`${actionType === "REDEEM" ? "Redeemed" : "Top-up added"}! Balance: ₹${d.newBalance}`);
      setActionAmt("");
      load();
      const updated = await fetch(`/api/gift-cards/${selected.id}`).then(x => x.json());
      setSelected(updated.card);
    } else showToast(d.error ?? "Failed", "error");
  }

  async function deactivate(id: string) {
    if (!confirm("Deactivate this gift card?")) return;
    await fetch(`/api/gift-cards/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "DEACTIVATE" }) });
    showToast("Deactivated");
    load();
    setSelected(null);
  }

  const filtered = cards.filter(c => {
    const matchSearch = !search || c.code.toLowerCase().includes(search.toLowerCase()) || c.recipientName?.toLowerCase().includes(search.toLowerCase()) || c.recipientPhone?.includes(search);
    const matchFilter = filter === "ALL" || (filter === "ACTIVE" ? c.isActive : !c.isActive);
    return matchSearch && matchFilter;
  });

  const totalIssued  = cards.reduce((s, c) => s + c.initialValue, 0);
  const totalBalance = cards.filter(c => c.isActive).reduce((s, c) => s + c.balance, 0);
  const totalRedeemed = cards.reduce((s, c) => s + c.transactions.filter(t => t.type === "REDEEM").reduce((a, t) => a + t.amount, 0), 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>🎁 Gift Cards</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>Issue, redeem, and manage gift cards</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ Issue Gift Card</button>
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Total Issued", value: `₹${totalIssued.toLocaleString("en-IN")}`, icon: "🎁", color: "#2563EB" },
          { label: "Outstanding Balance", value: `₹${totalBalance.toLocaleString("en-IN")}`, icon: "💳", color: "#D97706" },
          { label: "Total Redeemed", value: `₹${totalRedeemed.toLocaleString("en-IN")}`, icon: "✅", color: "#16A34A" },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#64748B" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input className="input" placeholder="Search by code, name, phone…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
        {(["ALL", "ACTIVE", "INACTIVE"] as const).map(f => (
          <button key={f} className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Card List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "60vh", overflowY: "auto" }}>
          {loading ? [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 90 }} />) :
           filtered.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: "#94A3B8" }}>No gift cards found</div> :
           filtered.map(c => (
            <div key={c.id} className="card" onClick={() => setSelected(c)}
              style={{ padding: 16, cursor: "pointer", border: selected?.id === c.id ? "2px solid var(--primary)" : "2px solid transparent", opacity: c.isActive ? 1 : 0.6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, fontFamily: "monospace", fontSize: 15 }}>{c.code}</div>
                  {c.recipientName && <div style={{ fontSize: 12, color: "#64748B" }}>{c.recipientName}{c.recipientPhone ? ` · ${c.recipientPhone}` : ""}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800, color: c.balance > 0 ? "#16A34A" : "#94A3B8", fontSize: 16 }}>₹{c.balance.toLocaleString("en-IN")}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>of ₹{c.initialValue.toLocaleString("en-IN")}</div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 9999, background: c.isActive ? "#F0FDF4" : "#F1F5F9", color: c.isActive ? "#16A34A" : "#94A3B8", fontWeight: 600 }}>
                  {c.isActive ? "ACTIVE" : "INACTIVE"}
                </span>
                {c.expiresAt && <span style={{ fontSize: 11, color: "#D97706" }}>Exp: {new Date(c.expiresAt).toLocaleDateString("en-IN")}</span>}
                <span style={{ fontSize: 11, color: "#94A3B8" }}>{new Date(c.purchasedAt).toLocaleDateString("en-IN")}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Detail Panel */}
        <div>
          {selected ? (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 800, fontFamily: "monospace", fontSize: 18 }}>{selected.code}</div>
                  {selected.recipientName && <div style={{ fontSize: 13, color: "#64748B" }}>{selected.recipientName}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#16A34A" }}>₹{selected.balance.toLocaleString("en-IN")}</div>
                  <div style={{ fontSize: 12, color: "#94A3B8" }}>Balance</div>
                </div>
              </div>

              {selected.isActive && (
                <div style={{ background: "#F8FAFC", borderRadius: 10, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    {(["REDEEM", "TOPUP"] as const).map(a => (
                      <button key={a} className={`btn btn-sm ${actionType === a ? "btn-primary" : "btn-ghost"}`} onClick={() => setActionType(a)}>{a === "REDEEM" ? "Redeem" : "Top-up"}</button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input className="input" type="number" placeholder="Amount ₹" value={actionAmt} onChange={e => setActionAmt(e.target.value)} style={{ flex: 1 }} />
                    <button className="btn btn-primary" onClick={doAction} disabled={acting}>{acting ? "…" : actionType}</button>
                  </div>
                  {actionType === "REDEEM" && selected.balance < parseFloat(actionAmt || "0") && (
                    <div style={{ fontSize: 12, color: "#DC2626", marginTop: 6 }}>Insufficient balance</div>
                  )}
                </div>
              )}

              {selected.isActive && (
                <button className="btn btn-ghost" style={{ color: "#DC2626", marginBottom: 12, fontSize: 12 }} onClick={() => deactivate(selected.id)}>Deactivate Card</button>
              )}

              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Transaction History</div>
              <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                {selected.transactions.length === 0 ? <div style={{ color: "#94A3B8", fontSize: 13 }}>No transactions yet</div> :
                  selected.transactions.map(t => (
                    <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #F1F5F9" }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: TYPE_COLOR[t.type] ?? "#333" }}>{t.type}</span>
                        <div style={{ fontSize: 11, color: "#94A3B8" }}>{new Date(t.createdAt).toLocaleDateString("en-IN")}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 600, color: t.type === "REDEEM" ? "#DC2626" : "#16A34A" }}>
                          {t.type === "REDEEM" ? "-" : "+"}₹{t.amount.toLocaleString("en-IN")}
                        </div>
                        <div style={{ fontSize: 11, color: "#94A3B8" }}>Bal: ₹{t.balanceAfter.toLocaleString("en-IN")}</div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎁</div>
              <p>Select a gift card to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* New Card Modal */}
      {showNew && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: 400, padding: 28 }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 800 }}>Issue Gift Card</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Value (₹) *</label>
                <input className="input" type="number" placeholder="e.g. 500" value={newVal} onChange={e => setNewVal(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Recipient Name</label>
                <input className="input" placeholder="Optional" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Recipient Phone</label>
                <input className="input" placeholder="Optional" value={newPhone} onChange={e => setNewPhone(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Expiry Date</label>
                <input className="input" type="date" value={newExp} onChange={e => setNewExp(e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowNew(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={createCard} disabled={creating}>{creating ? "Creating…" : "Issue Card"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
