"use client";
import { useState, useEffect, useCallback } from "react";
import { showToast } from "@/components/Toast";

type Category = { id: string; name: string; sortOrder: number; items: MenuItem[] };
type MenuItem = { id: string; name: string; price: number; isVeg: boolean; isAvailable: boolean; description?: string };

type ItemForm = { name: string; price: string; isVeg: boolean; isAvailable: boolean; description: string; categoryId: string };

const EMPTY_FORM: ItemForm = { name: "", price: "", isVeg: true, isAvailable: true, description: "", categoryId: "" };

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<"items" | "categories">("items");
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(EMPTY_FORM);
  const [catName, setCatName] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/categories");
    const data = await res.json();
    setCategories(data.categories ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAddItem(categoryId?: string) {
    setEditItem(null);
    const firstCatId = categoryId ?? categories[0]?.id ?? "";
    if (!firstCatId) {
      showToast("Please add a category first, then add items", "error");
      setActiveTab("categories");
      setShowCatModal(true);
      return;
    }
    setItemForm({ ...EMPTY_FORM, categoryId: firstCatId });
    setShowItemModal(true);
  }

  function openEditItem(item: MenuItem, categoryId: string) {
    setEditItem(item);
    setItemForm({
      name: item.name, price: String(item.price), isVeg: item.isVeg,
      isAvailable: item.isAvailable, description: item.description ?? "", categoryId,
    });
    setShowItemModal(true);
  }

  async function saveItem() {
    setLoading(true);
    if (!itemForm.name.trim()) { showToast("Item name required", "error"); setLoading(false); return; }
    if (!itemForm.price || parseFloat(itemForm.price) <= 0) { showToast("Valid price required", "error"); setLoading(false); return; }
    if (!itemForm.categoryId) { showToast("Please select a category", "error"); setLoading(false); return; }
    const body = { ...itemForm, price: parseFloat(itemForm.price) };
    try {
      const url = editItem ? `/api/menu-items/${editItem.id}` : "/api/menu-items";
      const res = await fetch(url, {
        method: editItem ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast(editItem ? "Item updated!" : "Item added!");
      setShowItemModal(false);
      await load();
    } catch (err: any) {
      showToast(err.message ?? "Failed to save", "error");
    } finally {
      setLoading(false);
    }
  }

  async function toggleAvailable(item: MenuItem, categoryId: string) {
    const res = await fetch(`/api/menu-items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...item, categoryId, isAvailable: !item.isAvailable }),
    });
    if (res.ok) {
      showToast(item.isAvailable ? "Item marked unavailable" : "Item is now available");
      await load();
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this item?")) return;
    const res = await fetch(`/api/menu-items/${id}`, { method: "DELETE" });
    const data = await res.json();
    showToast(data.message ?? "Item deleted");
    await load();
  }

  async function addCategory() {
    if (!catName.trim()) return;
    setLoading(true);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: catName.trim() }),
    });
    if (res.ok) {
      showToast("Category added!");
      setCatName("");
      setShowCatModal(false);
      await load();
    } else {
      showToast((await res.json()).error ?? "Failed", "error");
    }
    setLoading(false);
  }

  const allItems = categories.flatMap((c) => c.items.map((i) => ({ ...i, categoryId: c.id, categoryName: c.name })));
  const filtered = searchTerm ? allItems.filter((i) => i.name.toLowerCase().includes(searchTerm.toLowerCase())) : allItems;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Menu Management</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>
            {allItems.length} items across {categories.length} categories
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowCatModal(true)}>+ Category</button>
          <button className="btn btn-primary btn-sm" onClick={() => openAddItem()}>+ Add Item</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button className={`btn btn-sm ${activeTab === "items" ? "btn-primary" : "btn-ghost"}`} onClick={() => setActiveTab("items")}>All Items</button>
        <button className={`btn btn-sm ${activeTab === "categories" ? "btn-primary" : "btn-ghost"}`} onClick={() => setActiveTab("categories")}>Categories</button>
      </div>

      {activeTab === "items" ? (
        <div>
          {/* Search */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body" style={{ padding: "12px 16px" }}>
              <input className="form-input" placeholder="🔍 Search menu items..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>

          {/* Items by category */}
          {(searchTerm ? [{ id: "search", name: "Search Results", sortOrder: 0, items: filtered }] : categories).map((cat) => {
            const items = searchTerm ? filtered : cat.items.map((i) => ({ ...i, categoryId: cat.id, categoryName: cat.name }));
            if (items.length === 0 && !searchTerm) return null;
            return (
              <div className="card" key={cat.id} style={{ marginBottom: 16 }}>
                <div className="card-header">
                  <h3 className="card-title">{cat.name} ({items.length})</h3>
                  {!searchTerm && <button className="btn btn-ghost btn-sm" onClick={() => openAddItem(cat.id)}>+ Add to {cat.name}</button>}
                </div>
                {items.length === 0 ? (
                  <div style={{ padding: "20px 20px", color: "#94A3B8", fontSize: 13 }}>No items in this category yet.</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                          {["Item", "Type", "Price", "Status", "Actions"].map((h) => (
                            <th key={h} style={{ padding: "8px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id} style={{ borderBottom: "1px solid #F1F5F9", opacity: item.isAvailable ? 1 : 0.5 }}>
                            <td style={{ padding: "12px 16px" }}>
                              <div style={{ fontWeight: 600 }}>{item.name}</div>
                              {item.description && <div style={{ fontSize: 11, color: "#94A3B8" }}>{item.description}</div>}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span className={`veg-dot ${item.isVeg ? "veg" : "nonveg"}`} />
                                <span style={{ fontSize: 11, fontWeight: 600, color: item.isVeg ? "#16A34A" : "#DC2626" }}>
                                  {item.isVeg ? "Veg" : "Non-Veg"}
                                </span>
                              </span>
                            </td>
                            <td style={{ padding: "12px 16px", fontWeight: 700, color: "#E8721C" }}>₹{item.price.toFixed(2)}</td>
                            <td style={{ padding: "12px 16px" }}>
                              <span className={`badge ${item.isAvailable ? "badge-ready" : "badge-cancelled"}`}>
                                {item.isAvailable ? "Available" : "Unavailable"}
                              </span>
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => openEditItem(item, item.categoryId)}>Edit</button>
                                <button className={`btn btn-sm ${item.isAvailable ? "btn-danger" : "btn-success"}`}
                                  onClick={() => toggleAvailable(item, item.categoryId)}>
                                  {item.isAvailable ? "Disable" : "Enable"}
                                </button>
                                <button className="btn btn-danger btn-sm" onClick={() => deleteItem(item.id)}>Delete</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          {allItems.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🍽️</div>
              <p style={{ fontSize: 15, fontWeight: 600 }}>Menu is empty</p>
              <p style={{ fontSize: 13 }}>Add categories first, then add menu items</p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
                <button className="btn btn-ghost" onClick={() => setShowCatModal(true)}>+ Add Category</button>
                <button className="btn btn-primary" onClick={() => openAddItem()}>+ Add Item</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          {categories.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
              <p style={{ fontSize: 15, fontWeight: 600 }}>No categories yet</p>
              <button className="btn btn-primary" onClick={() => setShowCatModal(true)} style={{ marginTop: 12 }}>+ Add Category</button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              {categories.map((c) => (
                <div key={c.id} className="card" style={{ padding: 20 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{c.name}</div>
                  <div style={{ fontSize: 13, color: "#64748B" }}>{c.items.length} items</div>
                  <div style={{ marginTop: 12 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { openAddItem(c.id); setActiveTab("items"); }}>+ Add Item</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Item Modal */}
      {showItemModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowItemModal(false)}>
          <div className="modal">
            <h3 className="modal-title">{editItem ? "Edit Item" : "Add Menu Item"}</h3>
            <div className="form-group">
              <label className="form-label">Item Name *</label>
              <input className="form-input" placeholder="e.g. Paneer Butter Masala" value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" placeholder="Optional description" value={itemForm.description}
                onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Price (₹) *</label>
                <input className="form-input" type="number" placeholder="0.00" value={itemForm.price}
                  onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select className="form-select" value={itemForm.categoryId}
                  onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}>
                  <option value="">Select category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input type="radio" name="type" checked={itemForm.isVeg} onChange={() => setItemForm({ ...itemForm, isVeg: true })} />
                <span className="veg-dot veg" /> Veg
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input type="radio" name="type" checked={!itemForm.isVeg} onChange={() => setItemForm({ ...itemForm, isVeg: false })} />
                <span className="veg-dot nonveg" /> Non-Veg
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setShowItemModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveItem} disabled={loading}>
                {loading ? "Saving..." : editItem ? "Update Item" : "Add Item"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showCatModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCatModal(false)}>
          <div className="modal">
            <h3 className="modal-title">Add Category</h3>
            <div className="form-group">
              <label className="form-label">Category Name</label>
              <input className="form-input" placeholder="e.g. Starters, Main Course, Beverages" value={catName}
                onChange={(e) => setCatName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCategory()} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setShowCatModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addCategory} disabled={loading}>Add Category</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
