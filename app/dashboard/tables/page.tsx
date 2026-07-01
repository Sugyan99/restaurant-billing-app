"use client";
import { useState, useEffect, useCallback } from "react";
import { showToast } from "@/components/Toast";

type Table = {
  id: string; number: string; capacity: number; status: "FREE" | "OCCUPIED" | "RESERVED";
  orders: Order[];
};
type Category = { id: string; name: string; items: MenuItem[] };
type MenuItem = { id: string; name: string; price: number; isVeg: boolean; isAvailable: boolean };
type OrderItem = { menuItemId: string; name: string; price: number; quantity: number; notes?: string };
type Order = {
  id: string; orderNumber: number; status: string; type: string;
  items: { id: string; quantity: number; price: number; menuItem: MenuItem; notes?: string }[];
};

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKEAWAY">("DINE_IN");
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showAddTable, setShowAddTable] = useState(false);
  const [newTableNum, setNewTableNum] = useState("");
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  const loadTables = useCallback(async () => {
    const res = await fetch("/api/tables");
    const data = await res.json();
    setTables(data.tables ?? []);
  }, []);

  const loadCategories = useCallback(async () => {
    const res = await fetch("/api/categories");
    const data = await res.json();
    setCategories(data.categories ?? []);
  }, []);

  useEffect(() => {
    loadTables();
    loadCategories();
    const interval = setInterval(loadTables, 15000); // auto-refresh every 15s
    return () => clearInterval(interval);
  }, [loadTables, loadCategories]);

  function openTable(table: Table) {
    setSelectedTable(table);
    setCart([]);
    setDiscount(0);
    setActiveCategory("all");
    const activeOrderOnTable = table.orders?.find(
      (o) => ["PENDING", "PREPARING", "READY"].includes(o.status)
    );
    setActiveOrder(activeOrderOnTable ?? null);
    setShowNewOrder(true);
  }

  function addToCart(item: MenuItem) {
    if (!item.isAvailable) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.menuItemId === item.id);
      if (existing) {
        return prev.map((i) => i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  }

  function updateQty(menuItemId: string, delta: number) {
    setCart((prev) => {
      const updated = prev.map((i) =>
        i.menuItemId === menuItemId ? { ...i, quantity: i.quantity + delta } : i
      ).filter((i) => i.quantity > 0);
      return updated;
    });
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const cgst = ((subtotal - discount) * 2.5) / 100;
  const sgst = ((subtotal - discount) * 2.5) / 100;
  const total = subtotal - discount + cgst + sgst;

  const allItems = categories.flatMap((c) => c.items);
  const filteredItems = activeCategory === "all" ? allItems : allItems.filter(
    (item) => categories.find((c) => c.id === activeCategory)?.items.some((i) => i.id === item.id)
  );

  async function placeOrder() {
    if (cart.length === 0) { showToast("Add items to the order first", "error"); return; }
    setLoading(true);
    try {
      if (activeOrder) {
        // Add more items to existing order
        const res = await fetch(`/api/orders/${activeOrder.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: cart.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })) }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        showToast("Items added to order!");
      } else {
        // New order
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: selectedTable ? "DINE_IN" : orderType,
            tableId: selectedTable?.id,
            items: cart.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        showToast("Order placed! KOT sent to kitchen.");
      }
      setShowNewOrder(false);
      setCart([]);
      await loadTables();
    } catch (err: any) {
      showToast(err.message ?? "Failed to place order", "error");
    } finally {
      setLoading(false);
    }
  }

  async function generateBill() {
    if (!activeOrder) { showToast("No active order on this table", "error"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: activeOrder.id, discount }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      showToast("Bill generated! Proceed to payment.");
      setShowNewOrder(false);
      await loadTables();
    } catch (err: any) {
      showToast(err.message ?? "Failed to generate bill", "error");
    } finally {
      setLoading(false);
    }
  }

  async function addTable() {
    if (!newTableNum.trim()) return;
    const res = await fetch("/api/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: newTableNum.trim() }),
    });
    if (res.ok) {
      showToast(`Table ${newTableNum} added!`);
      setNewTableNum("");
      setShowAddTable(false);
      await loadTables();
    } else {
      showToast("Could not add table", "error");
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Floor View</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>
            {tables.filter((t) => t.status === "FREE").length} free · {tables.filter((t) => t.status === "OCCUPIED").length} occupied
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => { setOrderType("TAKEAWAY"); setSelectedTable(null); setShowNewOrder(true); setCart([]); setActiveOrder(null); }}>
            + Takeaway Order
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddTable(true)}>
            + Add Table
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        {[["#86EFAC", "#F0FDF4", "Free"], ["#FDBA74", "#FFF7ED", "Occupied"], ["#93C5FD", "#EFF6FF", "Reserved"]].map(
          ([border, bg, label]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 14, height: 14, borderRadius: 4, background: bg, border: `2px solid ${border}` }} />
              <span style={{ fontSize: 12, color: "#64748B" }}>{label}</span>
            </div>
          )
        )}
      </div>

      {/* Table Grid */}
      {tables.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🪑</div>
          <p style={{ fontSize: 15, fontWeight: 600 }}>No tables yet</p>
          <p style={{ fontSize: 13 }}>Add your first table to start taking orders</p>
          <button className="btn btn-primary" onClick={() => setShowAddTable(true)} style={{ marginTop: 12 }}>+ Add Table</button>
        </div>
      ) : (
        <div className="table-grid">
          {tables.map((table) => (
            <div key={table.id} className={`table-card ${table.status.toLowerCase()}`} onClick={() => openTable(table)}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase" }}>Table</div>
              <div className="table-num">{table.number}</div>
              <div className="table-status">
                {table.status === "FREE" ? "✓ Free" : table.status === "OCCUPIED" ? "● Occupied" : "○ Reserved"}
              </div>
              {table.orders?.length > 0 && (
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                  {table.orders.length} active order{table.orders.length > 1 ? "s" : ""}
                </div>
              )}
              <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>Cap: {table.capacity}</div>
            </div>
          ))}
        </div>
      )}

      {/* Order Modal */}
      {showNewOrder && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowNewOrder(false)}>
          <div style={{ background: "white", borderRadius: 16, width: "95%", maxWidth: 900, height: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Modal header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
                  {selectedTable ? `Table ${selectedTable.number}` : "Takeaway Order"}
                </h3>
                {activeOrder && (
                  <span style={{ fontSize: 12, color: "#E8721C" }}>Order #{activeOrder.orderNumber} is active — adding items</span>
                )}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowNewOrder(false)}>✕ Close</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", flex: 1, overflow: "hidden" }}>
              {/* Left: Menu */}
              <div style={{ padding: 16, overflowY: "auto", borderRight: "1px solid #E2E8F0" }}>
                {/* Category tabs */}
                <div className="category-tabs">
                  <div className={`cat-tab ${activeCategory === "all" ? "active" : ""}`} onClick={() => setActiveCategory("all")}>All</div>
                  {categories.map((c) => (
                    <div key={c.id} className={`cat-tab ${activeCategory === c.id ? "active" : ""}`} onClick={() => setActiveCategory(c.id)}>
                      {c.name}
                    </div>
                  ))}
                </div>

                {filteredItems.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "#94A3B8" }}>
                    <p>No menu items. Add items in the Menu section.</p>
                  </div>
                ) : (
                  <div className="menu-grid">
                    {filteredItems.map((item) => (
                      <div key={item.id} className={`menu-item-card ${!item.isAvailable ? "unavailable" : ""}`} onClick={() => addToCart(item)}>
                        <div>
                          <span className={`veg-dot ${item.isVeg ? "veg" : "nonveg"}`} />
                          <span style={{ fontSize: 10, color: item.isVeg ? "#16A34A" : "#DC2626", fontWeight: 600 }}>
                            {item.isVeg ? "VEG" : "NON-VEG"}
                          </span>
                        </div>
                        <div className="item-name">{item.name}</div>
                        <div className="item-price">₹{item.price.toFixed(2)}</div>
                        {!item.isAvailable && <div style={{ fontSize: 10, color: "#DC2626", fontWeight: 600 }}>UNAVAILABLE</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Bill */}
              <div className="bill-panel" style={{ borderRadius: 0 }}>
                <div className="bill-panel-header">
                  <h3>Current Order</h3>
                  <p>{cart.length} item{cart.length !== 1 ? "s" : ""} added</p>
                </div>
                <div className="bill-items">
                  {cart.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "30px 0", color: "#94A3B8", fontSize: 13 }}>
                      Tap menu items to add them
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div key={item.menuItemId} className="bill-item">
                        <span className="bill-item-name">{item.name}</span>
                        <div className="bill-item-qty">
                          <button className="qty-btn" onClick={() => updateQty(item.menuItemId, -1)}>−</button>
                          <span style={{ fontSize: 13, fontWeight: 700, minWidth: 20, textAlign: "center" }}>{item.quantity}</span>
                          <button className="qty-btn" onClick={() => updateQty(item.menuItemId, 1)}>+</button>
                        </div>
                        <span className="bill-item-price">₹{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="bill-footer">
                  <div className="bill-row">
                    <span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="bill-row" style={{ alignItems: "center" }}>
                    <span>Discount</span>
                    <input
                      type="number" min="0" value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                      style={{ width: 70, padding: "2px 8px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 12, textAlign: "right" }}
                    />
                  </div>
                  <div className="bill-row"><span>CGST (2.5%)</span><span>₹{cgst.toFixed(2)}</span></div>
                  <div className="bill-row"><span>SGST (2.5%)</span><span>₹{sgst.toFixed(2)}</span></div>
                  <div className="bill-row total"><span>TOTAL</span><span>₹{total.toFixed(2)}</span></div>
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    <button className="btn btn-primary" style={{ justifyContent: "center" }} onClick={placeOrder} disabled={loading || cart.length === 0}>
                      {loading ? "Placing..." : activeOrder ? "🍳 Add to KOT" : "🍳 Place Order + KOT"}
                    </button>
                    {activeOrder && (
                      <button className="btn btn-success" style={{ justifyContent: "center" }} onClick={generateBill} disabled={loading}>
                        🧾 Generate Bill
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Table Modal */}
      {showAddTable && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowAddTable(false)}>
          <div className="modal">
            <h3 className="modal-title">Add New Table</h3>
            <div className="form-group">
              <label className="form-label">Table Number / Name</label>
              <input className="form-input" placeholder="e.g. 1, 2, A1, Terrace-1" value={newTableNum}
                onChange={(e) => setNewTableNum(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTable()} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setShowAddTable(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addTable}>Add Table</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
