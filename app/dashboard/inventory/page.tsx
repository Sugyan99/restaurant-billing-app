"use client";
import { useState, useEffect, useCallback } from "react";
import { showToast } from "@/components/Toast";

type Item = { id: string; name: string; unit: string; currentStock: number; minStock: number; costPerUnit: number };
const EMPTY = { name: "", unit: "kg", currentStock: 0, minStock: 1, costPerUnit: 0 };
const UNITS = ["kg", "g", "L", "ml", "pcs", "dozen", "box", "bag"];

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [lowStock, setLowStock] = useState<Item[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/inventory");
    const data = await res.json();
    setItems(data.items ?? []);
    setLowStock(data.lowStock ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditItem(null); setForm(EMPTY); setShowModal(true); }
  function openEdit(item: Item) { setEditItem(item); setForm({ name: item.name, unit: item.unit, currentStock: item.currentStock, minStock: item.minStock, costPerUnit: item.costPerUnit }); setShowModal(true); }

  async function save() {
    if (!form.name.trim()) { showToast("Name is required", "error"); return; }
    setLoading(true);
    try {
      const url = editItem ? `/api/inventory/${editItem.id}` : "/api/inventory";
      const res = await fetch(url, { method: editItem ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast(editItem ? "Item updated!" : "Item added!");
      setShowModal(false);
      await load();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setLoading(false); }
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this item?")) return;
    await fetch(`/api/inventory/${id}`, { method: "DELETE" });
    showToast("Deleted"); await load();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Inventory</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>{items.length} items · {lowStock.length} low stock</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Item</button>
      </div>

      {lowStock.length > 0 && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#DC2626" }}>⚠️ Low Stock:</span>
          {lowStock.map(i => (
            <span key={i.id} style={{ fontSize: 12, background: "white", padding: "2px 10px", borderRadius: 20, border: "1px solid #FECACA", color: "#DC2626", fontWeight: 600 }}>
              {i.name} ({i.currentStock}{i.unit})
            </span>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
          <p style={{ fontWeight: 600 }}>No inventory items yet</p>
          <button className="btn btn-primary" onClick={openAdd} style={{ marginTop: 12 }}>+ Add First Item</button>
        </div>
      ) : (
        <div className="card">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                  {["Item", "Unit", "Current Stock", "Min Stock", "Cost/Unit", "Status", "Actions"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const isLow = item.currentStock <= item.minStock;
                  return (
                    <tr key={item.id} style={{ borderBottom: "1px solid #F1F5F9", background: isLow ? "#FFF5F5" : "white" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 600 }}>{item.name}</td>
                      <td style={{ padding: "12px 16px", color: "#64748B" }}>{item.unit}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 700, color: isLow ? "#DC2626" : "#16A34A" }}>{item.currentStock}</td>
                      <td style={{ padding: "12px 16px", color: "#64748B" }}>{item.minStock}</td>
                      <td style={{ padding: "12px 16px" }}>₹{item.costPerUnit.toFixed(2)}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span className={`badge ${isLow ? "badge-cancelled" : "badge-ready"}`}>{isLow ? "⚠️ Low" : "✓ OK"}</span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteItem(item.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h3 className="modal-title">{editItem ? "Edit Item" : "Add Inventory Item"}</h3>
            <div className="form-group">
              <label className="form-label">Item Name *</label>
              <input className="form-input" placeholder="e.g. Tomatoes" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <select className="form-select" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Cost per Unit (₹)</label>
                <input className="form-input" type="number" step="0.01" value={form.costPerUnit} onChange={e => setForm({ ...form, costPerUnit: parseFloat(e.target.value) })} />
              </div>
              <div className="form-group">
                <label className="form-label">Current Stock</label>
                <input className="form-input" type="number" step="0.1" value={form.currentStock} onChange={e => setForm({ ...form, currentStock: parseFloat(e.target.value) })} />
              </div>
              <div className="form-group">
                <label className="form-label">Min Stock (Alert)</label>
                <input className="form-input" type="number" step="0.1" value={form.minStock} onChange={e => setForm({ ...form, minStock: parseFloat(e.target.value) })} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={loading}>{loading ? "Saving..." : editItem ? "Update" : "Add Item"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
