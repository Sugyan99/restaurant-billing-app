"use client";
import { useState, useEffect, useCallback } from "react";
import { showToast } from "@/components/Toast";
import { DeleteButton } from "@/components/DeleteButton";

type POItem = { id: string; name: string; quantity: number; unit: string; costPerUnit: number; total: number };
type PO = { id: string; supplierName: string; status: string; totalAmount: number; notes?: string; expectedAt?: string; createdAt: string; items: POItem[] };

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING:   { bg: "#FFF7ED", color: "#EA580C" },
  ORDERED:   { bg: "#EFF6FF", color: "#2563EB" },
  RECEIVED:  { bg: "#F0FDF4", color: "#16A34A" },
  CANCELLED: { bg: "#FEF2F2", color: "#DC2626" },
};
const STATUS_FLOW: Record<string, string> = { PENDING: "ORDERED", ORDERED: "RECEIVED" };
const UNITS = ["kg", "g", "L", "ml", "pcs", "box", "bag", "dozen"];

const EMPTY_ITEM = { name: "", quantity: 1, unit: "kg", costPerUnit: 0 };

export default function PurchaseOrdersPage() {
  const [orders, setOrders]     = useState<PO[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("ALL");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy]         = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Form state
  const [supplier, setSupplier]   = useState("");
  const [notes, setNotes]         = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);

  const load = useCallback(async () => {
    const res = await fetch("/api/purchase-orders");
    const d = await res.json();
    setOrders(d.orders ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function addItem() { setItems(p => [...p, { ...EMPTY_ITEM }]); }
  function removeItem(i: number) { setItems(p => p.filter((_, idx) => idx !== i)); }
  function updateItem(i: number, field: string, val: string | number) {
    setItems(p => p.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  }
  const total = items.reduce((s, i) => s + (i.quantity * i.costPerUnit), 0);

  async function submitPO() {
    if (!supplier.trim()) { showToast("Supplier name required", "error"); return; }
    if (items.some(i => !i.name.trim() || i.quantity <= 0 || i.costPerUnit < 0)) {
      showToast("Fill all item details correctly", "error"); return;
    }
    setBusy(true);
    const res = await fetch("/api/purchase-orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierName: supplier, notes, expectedAt: expectedAt || undefined, items }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) { showToast(d.error ?? "Failed", "error"); return; }
    showToast("Purchase order created!");
    setShowForm(false); setSupplier(""); setNotes(""); setExpectedAt(""); setItems([{ ...EMPTY_ITEM }]);
    load();
  }

  async function advance(po: PO) {
    const next = STATUS_FLOW[po.status];
    if (!next) return;
    const res = await fetch(`/api/purchase-orders/${po.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) { showToast(`Marked as ${next}`); load(); }
    else showToast("Failed", "error");
  }

  async function cancel(po: PO) {
    if (!confirm("Cancel this purchase order?")) return;
    const res = await fetch(`/api/purchase-orders/${po.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    if (res.ok) { showToast("Cancelled"); load(); }
  }

  const displayed = filter === "ALL" ? orders : orders.filter(o => o.status === filter);
  const stats = { total: orders.length, pending: orders.filter(o => o.status === "PENDING").length, ordered: orders.filter(o => o.status === "ORDERED").length, received: orders.filter(o => o.status === "RECEIVED").length };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Purchase Orders</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>{stats.pending} pending · {stats.ordered} ordered · {stats.received} received</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? "✕ Cancel" : "+ New Order"}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: 18 }}>
        {[["Total", stats.total, "#6366F1"],["Pending", stats.pending, "#EA580C"],["Ordered", stats.ordered, "#2563EB"],["Received", stats.received, "#16A34A"]].map(([label, val, color]) => (
          <div key={label as string} className="card" style={{ padding: "12px 16px", borderLeft: `3px solid ${color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: color as string }}>{val}</div>
            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-header"><h3 className="card-title">New Purchase Order</h3></div>
          <div style={{ padding: "0 20px 20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={LBL}>Supplier Name *</label>
                <input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="e.g. Fresh Farms Ltd"
                  style={INP} />
              </div>
              <div>
                <label style={LBL}>Expected Delivery</label>
                <input type="date" value={expectedAt} onChange={e => setExpectedAt(e.target.value)} style={INP} />
              </div>
            </div>

            {/* Items */}
            <label style={LBL}>Items *</label>
            <div style={{ border: "1px solid #E2E8F0", borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 100px 36px", gap: 8, padding: "8px 12px", background: "#F8FAFC", fontSize: 11, fontWeight: 700, color: "#64748B" }}>
                <span>ITEM NAME</span><span>QTY</span><span>UNIT</span><span>COST/UNIT (₹)</span><span></span>
              </div>
              {items.map((item, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 100px 36px", gap: 8, padding: "6px 12px", borderTop: "1px solid #F1F5F9", alignItems: "center" }}>
                  <input value={item.name} onChange={e => updateItem(i, "name", e.target.value)} placeholder="Item name" style={{ ...INP, marginBottom: 0 }} />
                  <input type="number" value={item.quantity} min={0.1} step={0.1} onChange={e => updateItem(i, "quantity", parseFloat(e.target.value) || 0)} style={{ ...INP, marginBottom: 0 }} />
                  <select value={item.unit} onChange={e => updateItem(i, "unit", e.target.value)} style={{ ...INP, marginBottom: 0 }}>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                  <input type="number" value={item.costPerUnit} min={0} step={0.01} onChange={e => updateItem(i, "costPerUnit", parseFloat(e.target.value) || 0)} style={{ ...INP, marginBottom: 0 }} />
                  <button onClick={() => removeItem(i)} disabled={items.length === 1} style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer", fontSize: 16, padding: 0 }}>×</button>
                </div>
              ))}
              <div style={{ padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #F1F5F9" }}>
                <button className="btn btn-ghost btn-sm" onClick={addItem}>+ Add Item</button>
                <span style={{ fontWeight: 800, fontSize: 15 }}>Total: ₹{total.toFixed(2)}</span>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={LBL}>Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Any special instructions…" style={{ ...INP, resize: "vertical" }} />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={submitPO} disabled={busy}>{busy ? "Creating…" : "Create Purchase Order"}</button>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {["ALL", "PENDING", "ORDERED", "RECEIVED", "CANCELLED"].map(s => (
          <button key={s} className={`btn btn-sm ${filter === s ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(s)}>{s}</button>
        ))}
      </div>

      {/* List */}
      {loading ? <p style={{ color: "#94A3B8" }}>Loading…</p> : displayed.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🛒</div>
          <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>No purchase orders</p>
        </div>
      ) : displayed.map(po => {
        const s = STATUS_STYLE[po.status] ?? { bg: "#F8FAFC", color: "#64748B" };
        const isOpen = expanded === po.id;
        return (
          <div key={po.id} className="card" style={{ marginBottom: 10, border: `1px solid ${s.bg === "#FEF2F2" ? "#FCA5A5" : "#E2E8F0"}` }}>
            <div style={{ padding: "14px 18px", display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap", cursor: "pointer" }} onClick={() => setExpanded(isOpen ? null : po.id)}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontWeight: 800, fontSize: 15 }}>{po.supplierName}</span>
                  <span style={{ background: s.bg, color: s.color, fontSize: 10, fontWeight: 700, borderRadius: 5, padding: "2px 7px", textTransform: "uppercase" }}>{po.status}</span>
                </div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>
                  {po.items.length} items · {new Date(po.createdAt).toLocaleDateString("en-IN")}
                  {po.expectedAt && ` · Expected: ${new Date(po.expectedAt).toLocaleDateString("en-IN")}`}
                </div>
                {po.notes && <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>📝 {po.notes}</div>}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 17 }}>₹{po.totalAmount.toFixed(2)}</div>
                <div style={{ fontSize: 11, color: "#94A3B8" }}>{isOpen ? "▲ Hide" : "▼ Details"}</div>
              </div>
            </div>

            {isOpen && (
              <div style={{ borderTop: "1px solid #F1F5F9", padding: "12px 18px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                      {["Item", "Qty", "Unit", "Cost/Unit", "Total"].map(h => (
                        <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontSize: 11, color: "#64748B", fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {po.items.map(item => (
                      <tr key={item.id} style={{ borderBottom: "1px solid #F8FAFC" }}>
                        <td style={{ padding: "6px 8px" }}>{item.name}</td>
                        <td style={{ padding: "6px 8px" }}>{item.quantity}</td>
                        <td style={{ padding: "6px 8px", color: "#64748B" }}>{item.unit}</td>
                        <td style={{ padding: "6px 8px" }}>₹{item.costPerUnit}</td>
                        <td style={{ padding: "6px 8px", fontWeight: 700 }}>₹{item.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {STATUS_FLOW[po.status] && (
                    <button className="btn btn-primary btn-sm" onClick={() => advance(po)}>
                      → Mark as {STATUS_FLOW[po.status]}
                    </button>
                  )}
                  {["PENDING", "ORDERED"].includes(po.status) && (
                    <button className="btn btn-ghost btn-sm" style={{ color: "#DC2626" }} onClick={() => cancel(po)}>Cancel</button>
                  )}
                  <DeleteButton url={`/api/purchase-orders/${po.id}`} onDeleted={load} confirmMsg="Delete this purchase order?" />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const LBL: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 5, textTransform: "uppercase", letterSpacing: .4 };
const INP: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 0, fontFamily: "inherit" };
