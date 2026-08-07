"use client";
import { useState, useEffect, useCallback } from "react";
import { showToast } from "@/components/Toast";
import { PageTabs } from "@/components/PageTabs";
import StockLedgerPage from "@/app/dashboard/stock-ledger/page";

/* ─── Types ─────────────────────────────────────────────────── */
type Item = { id: string; name: string; unit: string; currentStock: number; minStock: number; costPerUnit: number; category: string; vendorId: string | null; vendor?: { id: string; name: string } | null };
type Vendor = { id: string; name: string; contact?: string; phone?: string; email?: string; address?: string; gstin?: string; isActive: boolean };
type MenuItem = { id: string; name: string; category: { name: string } };
type RecipeIngredient = { id: string; inventoryItemId: string; quantity: number; unit: string; inventoryItem: { id: string; name: string; unit: string; currentStock: number } };
type WasteEntry = { id: string; quantity: number; balanceAfter: number; note: string; createdAt: string; inventoryItem: { name: string; unit: string } };
type StockTx = { id: string; type: string; quantity: number; balanceAfter: number; note: string; createdAt: string };

const UNITS = ["kg", "g", "L", "ml", "pcs", "dozen", "box", "bag"];
const CATS = ["General", "Vegetables", "Fruits", "Dairy", "Meat", "Seafood", "Spices", "Grains", "Beverages", "Other"];
const EMPTY_ITEM = { name: "", unit: "kg", currentStock: 0, minStock: 1, costPerUnit: 0, category: "General", vendorId: null as string | null };
const TX_COLOR: Record<string, string> = { PURCHASE: "#16A34A", SALE: "#2563EB", WASTE: "#DC2626", ADJUST: "#D97706", RETURN: "#7C3AED" };

/* ─── Root ──────────────────────────────────────────────────── */
export default function InventoryPage() {
  return (
    <PageTabs tabs={[
      { id: "inventory", label: "Inventory",    icon: "📦" },
      { id: "recipes",   label: "Recipes",      icon: "🧪" },
      { id: "vendors",   label: "Vendors",      icon: "🏭" },
      { id: "waste",     label: "Waste Log",    icon: "🗑️" },
      { id: "history",   label: "Stock History",icon: "📋" },
      { id: "ledger",    label: "Ledger",       icon: "📒" },
    ]}>
      {tab => {
        if (tab === "recipes") return <RecipesTab />;
        if (tab === "vendors") return <VendorsTab />;
        if (tab === "waste")   return <WasteTab />;
        if (tab === "history") return <HistoryTab />;
        if (tab === "ledger")  return <StockLedgerPage />;
        return <InventoryTab />;
      }}
    </PageTabs>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 1 – Inventory (enhanced)
═══════════════════════════════════════════════════════════════ */
function InventoryTab() {
  const [items, setItems] = useState<Item[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [lowStock, setLowStock] = useState<Item[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [form, setForm] = useState({ ...EMPTY_ITEM });
  const [adjustItem, setAdjustItem] = useState<Item | null>(null);
  const [adjustVal, setAdjustVal] = useState(0);
  const [adjustNote, setAdjustNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [catFilter, setCatFilter] = useState("All");

  const load = useCallback(async () => {
    const [inv, vnd] = await Promise.all([fetch("/api/inventory"), fetch("/api/vendors")]);
    const [id, vd] = await Promise.all([inv.json(), vnd.json()]);
    setItems(id.items ?? []);
    setLowStock(id.lowStock ?? []);
    setVendors(vd.vendors ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditItem(null); setForm({ ...EMPTY_ITEM }); setShowModal(true); }
  function openEdit(item: Item) { setEditItem(item); setForm({ name: item.name, unit: item.unit, currentStock: item.currentStock, minStock: item.minStock, costPerUnit: item.costPerUnit, category: item.category, vendorId: item.vendorId }); setShowModal(true); }
  function openAdjust(item: Item) { setAdjustItem(item); setAdjustVal(item.currentStock); setAdjustNote(""); }

  async function save() {
    if (!form.name.trim()) { showToast("Name required", "error"); return; }
    setLoading(true);
    try {
      const url = editItem ? `/api/inventory/${editItem.id}` : "/api/inventory";
      const res = await fetch(url, { method: editItem ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast(editItem ? "Updated!" : "Added!");
      setShowModal(false); await load();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setLoading(false); }
  }

  async function doAdjust() {
    if (!adjustItem) return;
    setLoading(true);
    try {
      const res = await fetch("/api/inventory/adjust", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inventoryItemId: adjustItem.id, newStock: adjustVal, note: adjustNote }) });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast("Stock adjusted!"); setAdjustItem(null); await load();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setLoading(false); }
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete?")) return;
    await fetch(`/api/inventory/${id}`, { method: "DELETE" });
    showToast("Deleted"); await load();
  }

  const cats = ["All", ...Array.from(new Set(items.map(i => i.category)))];
  const visible = catFilter === "All" ? items : items.filter(i => i.category === catFilter);
  const totalValue = items.reduce((s, i) => s + i.currentStock * i.costPerUnit, 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Inventory</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>{items.length} items · {lowStock.length} low stock · Value: ₹{totalValue.toFixed(0)}</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Item</button>
      </div>

      {/* Low stock banner */}
      {lowStock.length > 0 && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#DC2626" }}>⚠️ Low Stock:</span>
          {lowStock.map(i => (
            <span key={i.id} style={{ fontSize: 12, background: "white", padding: "2px 10px", borderRadius: 20, border: "1px solid #FECACA", color: "#DC2626", fontWeight: 600 }}>
              {i.name} ({i.currentStock}{i.unit})
            </span>
          ))}
        </div>
      )}

      {/* Category filter */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {cats.map(c => (
          <button key={c} onClick={() => setCatFilter(c)} style={{ padding: "4px 12px", borderRadius: 20, border: "1px solid", fontSize: 12, fontWeight: 600, cursor: "pointer", background: catFilter === c ? "#E8721C" : "white", color: catFilter === c ? "white" : "#64748B", borderColor: catFilter === c ? "#E8721C" : "#E2E8F0" }}>{c}</button>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
              {["Item", "Category", "Unit", "Stock", "Min", "Cost/Unit", "Value", "Vendor", "Status", "Actions"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={10} style={{ padding: "40px", textAlign: "center", color: "#94A3B8" }}>No items</td></tr>
            )}
            {visible.map(item => {
              const isLow = item.currentStock <= item.minStock;
              return (
                <tr key={item.id} style={{ borderBottom: "1px solid #F1F5F9", background: isLow ? "#FFF5F5" : "white" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 600 }}>{item.name}</td>
                  <td style={{ padding: "10px 14px", color: "#64748B" }}><span style={{ background: "#F1F5F9", padding: "2px 8px", borderRadius: 12, fontSize: 11 }}>{item.category}</span></td>
                  <td style={{ padding: "10px 14px", color: "#64748B" }}>{item.unit}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 700, color: isLow ? "#DC2626" : "#16A34A" }}>{item.currentStock}</td>
                  <td style={{ padding: "10px 14px", color: "#64748B" }}>{item.minStock}</td>
                  <td style={{ padding: "10px 14px" }}>₹{item.costPerUnit.toFixed(2)}</td>
                  <td style={{ padding: "10px 14px", color: "#64748B" }}>₹{(item.currentStock * item.costPerUnit).toFixed(0)}</td>
                  <td style={{ padding: "10px 14px", color: "#64748B", fontSize: 12 }}>{item.vendor?.name ?? "—"}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span className={`badge ${isLow ? "badge-cancelled" : "badge-ready"}`}>{isLow ? "⚠️ Low" : "✓ OK"}</span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openAdjust(item)}>Adjust</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteItem(item.id)}>Del</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h3 className="modal-title">{editItem ? "Edit Item" : "Add Inventory Item"}</h3>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" placeholder="e.g. Tomatoes" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CATS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <select className="form-select" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Current Stock</label>
                <input className="form-input" type="number" step="0.1" value={form.currentStock} onChange={e => setForm({ ...form, currentStock: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label className="form-label">Min Stock Alert</label>
                <input className="form-input" type="number" step="0.1" value={form.minStock} onChange={e => setForm({ ...form, minStock: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label className="form-label">Cost/Unit (₹)</label>
                <input className="form-input" type="number" step="0.01" value={form.costPerUnit} onChange={e => setForm({ ...form, costPerUnit: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label className="form-label">Vendor</label>
                <select className="form-select" value={form.vendorId ?? ""} onChange={e => setForm({ ...form, vendorId: e.target.value || null })}>
                  <option value="">— None —</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={loading}>{loading ? "Saving..." : editItem ? "Update" : "Add"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Modal */}
      {adjustItem && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAdjustItem(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <h3 className="modal-title">Adjust Stock — {adjustItem.name}</h3>
            <p style={{ fontSize: 13, color: "#64748B", marginTop: 0 }}>Current: <b>{adjustItem.currentStock} {adjustItem.unit}</b></p>
            <div className="form-group">
              <label className="form-label">New Stock Quantity</label>
              <input className="form-input" type="number" step="0.1" value={adjustVal} onChange={e => setAdjustVal(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="form-group">
              <label className="form-label">Reason / Note</label>
              <input className="form-input" placeholder="e.g. Physical count, Spillage..." value={adjustNote} onChange={e => setAdjustNote(e.target.value)} />
            </div>
            <div style={{ fontSize: 13, color: adjustVal > adjustItem.currentStock ? "#16A34A" : "#DC2626", fontWeight: 600, marginBottom: 12 }}>
              Difference: {adjustVal > adjustItem.currentStock ? "+" : ""}{(adjustVal - adjustItem.currentStock).toFixed(2)} {adjustItem.unit}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setAdjustItem(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={doAdjust} disabled={loading}>{loading ? "Saving..." : "Apply Adjustment"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 2 – Recipe Mapping
═══════════════════════════════════════════════════════════════ */
function RecipesTab() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [invItems, setInvItems] = useState<Item[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<string>("");
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [addForm, setAddForm] = useState({ inventoryItemId: "", quantity: 0, unit: "kg" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([fetch("/api/menu-items"), fetch("/api/inventory")]).then(async ([mr, ir]) => {
      const [md, id] = await Promise.all([mr.json(), ir.json()]);
      setMenuItems(md.items ?? []);
      setInvItems(id.items ?? []);
    });
  }, []);

  useEffect(() => {
    if (!selectedMenu) { setIngredients([]); return; }
    fetch(`/api/recipes/${selectedMenu}`).then(r => r.json()).then(d => setIngredients(d.ingredients ?? []));
  }, [selectedMenu]);

  async function addIngredient() {
    if (!selectedMenu || !addForm.inventoryItemId || addForm.quantity <= 0) { showToast("Fill all fields", "error"); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/recipes/${selectedMenu}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(addForm) });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast("Ingredient added!");
      setAddForm({ inventoryItemId: "", quantity: 0, unit: "kg" });
      const d = await (await fetch(`/api/recipes/${selectedMenu}`)).json();
      setIngredients(d.ingredients ?? []);
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setLoading(false); }
  }

  async function removeIngredient(inventoryItemId: string) {
    if (!confirm("Remove?")) return;
    await fetch(`/api/recipes/${selectedMenu}?inventoryItemId=${inventoryItemId}`, { method: "DELETE" });
    showToast("Removed");
    const d = await (await fetch(`/api/recipes/${selectedMenu}`)).json();
    setIngredients(d.ingredients ?? []);
  }

  const selInvUnit = invItems.find(i => i.id === addForm.inventoryItemId)?.unit ?? "kg";

  return (
    <div>
      <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800 }}>Recipe Mapping</h2>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748B" }}>Map menu items to inventory ingredients for auto stock deduction</p>

      <div className="form-group" style={{ maxWidth: 360, marginBottom: 24 }}>
        <label className="form-label">Select Menu Item</label>
        <select className="form-select" value={selectedMenu} onChange={e => setSelectedMenu(e.target.value)}>
          <option value="">— Choose a dish —</option>
          {menuItems.map(m => <option key={m.id} value={m.id}>{m.name} ({m.category.name})</option>)}
        </select>
      </div>

      {selectedMenu && (
        <>
          {/* Existing ingredients */}
          {ingredients.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700 }}>Current Recipe</h4>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#F8FAFC" }}>
                    {["Ingredient", "Qty per Serving", "Current Stock", ""].map(h => (
                      <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map(ing => (
                    <tr key={ing.id} style={{ borderTop: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>{ing.inventoryItem.name}</td>
                      <td style={{ padding: "10px 14px" }}>{ing.quantity} {ing.unit}</td>
                      <td style={{ padding: "10px 14px", color: ing.inventoryItem.currentStock <= 0 ? "#DC2626" : "#16A34A" }}>{ing.inventoryItem.currentStock} {ing.inventoryItem.unit}</td>
                      <td style={{ padding: "10px 14px" }}><button className="btn btn-danger btn-sm" onClick={() => removeIngredient(ing.inventoryItemId)}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add ingredient form */}
          <div className="card">
            <h4 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700 }}>+ Add Ingredient</h4>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Inventory Item</label>
                <select className="form-select" value={addForm.inventoryItemId} onChange={e => setAddForm({ ...addForm, inventoryItemId: e.target.value, unit: invItems.find(i => i.id === e.target.value)?.unit ?? "kg" })}>
                  <option value="">— Select —</option>
                  {invItems.map(i => <option key={i.id} value={i.id}>{i.name} ({i.currentStock} {i.unit})</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Qty / Serving</label>
                <input className="form-input" type="number" step="0.001" placeholder="0" value={addForm.quantity || ""} onChange={e => setAddForm({ ...addForm, quantity: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Unit</label>
                <input className="form-input" value={selInvUnit} readOnly style={{ background: "#F8FAFC", cursor: "not-allowed" }} />
              </div>
              <button className="btn btn-primary" onClick={addIngredient} disabled={loading} style={{ marginBottom: 1 }}>{loading ? "..." : "Add"}</button>
            </div>
          </div>
        </>
      )}

      {!selectedMenu && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧪</div>
          <p style={{ fontWeight: 600 }}>Select a menu item to manage its recipe</p>
          <p style={{ fontSize: 13 }}>Stock is auto-deducted when bills are paid</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 3 – Vendors
═══════════════════════════════════════════════════════════════ */
function VendorsTab() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editV, setEditV] = useState<Vendor | null>(null);
  const EMPTY_V = { name: "", contact: "", phone: "", email: "", address: "", gstin: "", isActive: true };
  const [form, setForm] = useState(EMPTY_V);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const d = await (await fetch("/api/vendors")).json();
    setVendors(d.vendors ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditV(null); setForm(EMPTY_V); setShowModal(true); }
  function openEdit(v: Vendor) { setEditV(v); setForm({ name: v.name, contact: v.contact ?? "", phone: v.phone ?? "", email: v.email ?? "", address: v.address ?? "", gstin: v.gstin ?? "", isActive: v.isActive }); setShowModal(true); }

  async function save() {
    if (!form.name.trim()) { showToast("Name required", "error"); return; }
    setLoading(true);
    try {
      const url = editV ? `/api/vendors/${editV.id}` : "/api/vendors";
      const res = await fetch(url, { method: editV ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast(editV ? "Updated!" : "Added!");
      setShowModal(false); await load();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setLoading(false); }
  }

  async function del(id: string) {
    if (!confirm("Delete vendor?")) return;
    await fetch(`/api/vendors/${id}`, { method: "DELETE" });
    showToast("Deleted"); await load();
  }

  const f = (k: keyof typeof form, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Vendors</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>{vendors.length} suppliers</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Vendor</button>
      </div>

      {vendors.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏭</div>
          <p style={{ fontWeight: 600 }}>No vendors yet</p>
          <button className="btn btn-primary" onClick={openAdd} style={{ marginTop: 12 }}>+ Add First Vendor</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {vendors.map(v => (
            <div key={v.id} className="card" style={{ opacity: v.isActive ? 1 : 0.6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{v.name}</h4>
                <span className={`badge ${v.isActive ? "badge-ready" : "badge-cancelled"}`}>{v.isActive ? "Active" : "Inactive"}</span>
              </div>
              {v.contact && <p style={{ margin: "3px 0", fontSize: 13, color: "#64748B" }}>👤 {v.contact}</p>}
              {v.phone && <p style={{ margin: "3px 0", fontSize: 13, color: "#64748B" }}>📞 {v.phone}</p>}
              {v.email && <p style={{ margin: "3px 0", fontSize: 13, color: "#64748B" }}>✉️ {v.email}</p>}
              {v.gstin && <p style={{ margin: "3px 0", fontSize: 12, color: "#94A3B8" }}>GST: {v.gstin}</p>}
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(v)}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => del(v.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h3 className="modal-title">{editV ? "Edit Vendor" : "Add Vendor"}</h3>
            {[["name","Company Name *"], ["contact","Contact Person"], ["phone","Phone"], ["email","Email"], ["address","Address"], ["gstin","GSTIN"]].map(([k, label]) => (
              <div key={k} className="form-group">
                <label className="form-label">{label}</label>
                <input className="form-input" value={form[k as keyof typeof form] as string} onChange={e => f(k as keyof typeof form, e.target.value)} />
              </div>
            ))}
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer", marginBottom: 16 }}>
              <input type="checkbox" checked={form.isActive} onChange={e => f("isActive", e.target.checked)} />
              Active Vendor
            </label>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={loading}>{loading ? "Saving..." : editV ? "Update" : "Add"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 4 – Waste Log
═══════════════════════════════════════════════════════════════ */
function WasteTab() {
  const [entries, setEntries] = useState<WasteEntry[]>([]);
  const [invItems, setInvItems] = useState<Item[]>([]);
  const [form, setForm] = useState({ inventoryItemId: "", quantity: 0, note: "" });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const [we, ie] = await Promise.all([fetch("/api/inventory/waste"), fetch("/api/inventory")]);
    const [wd, id] = await Promise.all([we.json(), ie.json()]);
    setEntries(wd.entries ?? []);
    setInvItems(id.items ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function logWaste() {
    if (!form.inventoryItemId || form.quantity <= 0) { showToast("Select item and quantity", "error"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/inventory/waste", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast("Waste logged!");
      setForm({ inventoryItemId: "", quantity: 0, note: "" });
      await load();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setLoading(false); }
  }

  const totalWaste = entries.reduce((s, e) => s + Math.abs(e.quantity), 0);

  return (
    <div>
      <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800 }}>Waste Log</h2>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748B" }}>{entries.length} entries · Total waste recorded: {totalWaste.toFixed(2)} units</p>

      {/* Log waste form */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h4 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700 }}>Log New Waste</h4>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 2fr auto", gap: 10, alignItems: "end" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Item</label>
            <select className="form-select" value={form.inventoryItemId} onChange={e => setForm({ ...form, inventoryItemId: e.target.value })}>
              <option value="">— Select —</option>
              {invItems.map(i => <option key={i.id} value={i.id}>{i.name} ({i.currentStock} {i.unit})</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Quantity Lost</label>
            <input className="form-input" type="number" step="0.1" placeholder="0" value={form.quantity || ""} onChange={e => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Reason</label>
            <input className="form-input" placeholder="Spoilage, Dropped, Expired..." value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
          </div>
          <button className="btn btn-danger" onClick={logWaste} disabled={loading} style={{ marginBottom: 1 }}>{loading ? "..." : "Log Waste"}</button>
        </div>
      </div>

      {/* Waste history */}
      <div className="card" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F8FAFC" }}>
              {["Date/Time", "Item", "Qty Wasted", "Balance After", "Reason"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && <tr><td colSpan={5} style={{ padding: "40px", textAlign: "center", color: "#94A3B8" }}>No waste entries yet</td></tr>}
            {entries.map(e => (
              <tr key={e.id} style={{ borderTop: "1px solid #F1F5F9" }}>
                <td style={{ padding: "10px 14px", color: "#64748B", fontSize: 12 }}>{new Date(e.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                <td style={{ padding: "10px 14px", fontWeight: 600 }}>{e.inventoryItem.name}</td>
                <td style={{ padding: "10px 14px", color: "#DC2626", fontWeight: 700 }}>-{Math.abs(e.quantity).toFixed(2)} {e.inventoryItem.unit}</td>
                <td style={{ padding: "10px 14px", color: "#64748B" }}>{e.balanceAfter.toFixed(2)} {e.inventoryItem.unit}</td>
                <td style={{ padding: "10px 14px", color: "#64748B" }}>{e.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 5 – Stock History
═══════════════════════════════════════════════════════════════ */
function HistoryTab() {
  const [invItems, setInvItems] = useState<Item[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [txns, setTxns] = useState<StockTx[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/inventory").then(r => r.json()).then(d => setInvItems(d.items ?? []));
  }, []);

  useEffect(() => {
    if (!selectedId) { setTxns([]); return; }
    setLoading(true);
    fetch(`/api/inventory/${selectedId}/history`).then(r => r.json()).then(d => { setTxns(d.transactions ?? []); setLoading(false); });
  }, [selectedId]);

  const item = invItems.find(i => i.id === selectedId);

  return (
    <div>
      <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800 }}>Stock History</h2>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748B" }}>Full transaction log per inventory item</p>

      <div className="form-group" style={{ maxWidth: 360, marginBottom: 24 }}>
        <label className="form-label">Select Item</label>
        <select className="form-select" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
          <option value="">— Choose item —</option>
          {invItems.map(i => <option key={i.id} value={i.id}>{i.name} (Current: {i.currentStock} {i.unit})</option>)}
        </select>
      </div>

      {selectedId && item && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            {["PURCHASE","SALE","WASTE","ADJUST","RETURN"].map(type => {
              const count = txns.filter(t => t.type === type).length;
              const total = txns.filter(t => t.type === type).reduce((s, t) => s + t.quantity, 0);
              return (
                <div key={type} className="card" style={{ minWidth: 110, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: TX_COLOR[type] ?? "#64748B", marginBottom: 4 }}>{type}</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{count}</div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>{total > 0 ? "+" : ""}{total.toFixed(2)} {item.unit}</div>
                </div>
              );
            })}
          </div>

          <div className="card" style={{ overflowX: "auto" }}>
            {loading ? <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8" }}>Loading...</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#F8FAFC" }}>
                    {["Date/Time", "Type", "Quantity", "Balance After", "Note"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {txns.length === 0 && <tr><td colSpan={5} style={{ padding: "40px", textAlign: "center", color: "#94A3B8" }}>No transactions yet</td></tr>}
                  {txns.map(t => (
                    <tr key={t.id} style={{ borderTop: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "10px 14px", color: "#64748B", fontSize: 12 }}>{new Date(t.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: `${TX_COLOR[t.type]}20`, color: TX_COLOR[t.type] ?? "#64748B" }}>{t.type}</span>
                      </td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: t.quantity >= 0 ? "#16A34A" : "#DC2626" }}>
                        {t.quantity >= 0 ? "+" : ""}{t.quantity.toFixed(3)} {item.unit}
                      </td>
                      <td style={{ padding: "10px 14px", color: "#64748B" }}>{t.balanceAfter.toFixed(3)} {item.unit}</td>
                      <td style={{ padding: "10px 14px", color: "#64748B" }}>{t.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {!selectedId && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <p style={{ fontWeight: 600 }}>Select an item to view its stock history</p>
        </div>
      )}
    </div>
  );
}
