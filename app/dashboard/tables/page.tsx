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
  bill?: { id: string; total: number; paymentStatus: string } | null;
  items: { id: string; quantity: number; price: number; menuItem: MenuItem; notes?: string }[];
};

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKEAWAY" | "DELIVERY">("DINE_IN");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showAddTable, setShowAddTable] = useState(false);
  const [newTableNum, setNewTableNum] = useState("");
  const [discount, setDiscount]             = useState(0);
  const [loading, setLoading]               = useState(false);
  const [activeOrder, setActiveOrder]       = useState<Order | null>(null);
  const [discounts, setDiscounts]           = useState<{id:string;name:string;type:string;value:number}[]>([]);
  // Advanced POS state
  const [search, setSearch]                 = useState("");
  const [coverCount, setCoverCount]         = useState(1);
  const [kotNote, setKotNote]               = useState("");
  const [isPriority, setIsPriority]         = useState(false);
  const [noteTarget, setNoteTarget]         = useState<string | null>(null); // menuItemId with open note
  const [cashTendered, setCashTendered]     = useState<number | "">("");
  const [loyaltyPhone, setLoyaltyPhone]     = useState("");
  const [loyaltyCustomer, setLoyaltyCustomer] = useState<{name:string;phone:string;loyaltyPoints:number;redeemableAmount:number} | null>(null);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const [loyaltySearching, setLoyaltySearching] = useState(false);

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
    fetch("/api/discounts").then(r=>r.json()).then(d=>setDiscounts(d.discounts??[]));
    const interval = setInterval(loadTables, 15000); // auto-refresh every 15s
    return () => clearInterval(interval);
  }, [loadTables, loadCategories]);

  function openTable(table: Table) {
    setSelectedTable(table);
    setCart([]); setDiscount(0); setActiveCategory("all");
    setSearch(""); setCoverCount(1); setKotNote(""); setIsPriority(false);
    setNoteTarget(null); setCashTendered(""); setLoyaltyPhone(""); setLoyaltyCustomer(null); setLoyaltyDiscount(0);
    const activeOrderOnTable = table.orders?.find(o => ["PENDING","PREPARING","READY"].includes(o.status));
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

  function updateItemNote(menuItemId: string, note: string) {
    setCart(prev => prev.map(i => i.menuItemId === menuItemId ? { ...i, notes: note } : i));
  }

  async function searchLoyaltyCustomer() {
    if (!loyaltyPhone.trim()) return;
    setLoyaltySearching(true); setLoyaltyCustomer(null);
    const res = await fetch(`/api/loyalty?phone=${encodeURIComponent(loyaltyPhone.trim())}`);
    setLoyaltySearching(false);
    if (res.ok) { const d = await res.json(); setLoyaltyCustomer(d.customer); }
    else { showToast("Customer not found", "error"); }
  }

  async function redeemLoyaltyPoints(points: number) {
    const res = await fetch("/api/loyalty", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: loyaltyPhone, points }),
    });
    const d = await res.json();
    if (res.ok) { setLoyaltyDiscount(d.discount); setLoyaltyCustomer(prev => prev ? { ...prev, loyaltyPoints: d.remainingPoints } : null); showToast(d.message); }
    else showToast(d.error, "error");
  }

  const allItems = categories.flatMap((c) => c.items);
  const filteredItems = (activeCategory === "all" ? allItems : allItems.filter(
    (item) => categories.find((c) => c.id === activeCategory)?.items.some((i) => i.id === item.id)
  )).filter(item => !search || item.name.toLowerCase().includes(search.toLowerCase()));

  // Live billing calc
  const subtotal   = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const _disc      = Math.min(Math.max(0, discount + loyaltyDiscount), subtotal);
  const _taxable   = subtotal - _disc;
  const cgst       = parseFloat(((_taxable * 2.5) / 100).toFixed(2));
  const sgst       = parseFloat(((_taxable * 2.5) / 100).toFixed(2));
  const total      = parseFloat((_taxable + cgst + sgst).toFixed(2));
  const change     = typeof cashTendered === "number" ? cashTendered - total : null;

  function reprintBill(order: Order) {
    const bill = order.bill;
    if (!bill) return;
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    const items = order.items.map(i => `<div class="row"><span>${i.menuItem.name} x${i.quantity}</span><span>₹${(i.price*i.quantity).toFixed(2)}</span></div>`).join("");
    w.document.write(`<html><head><title>Bill Reprint</title><style>body{font-family:monospace;font-size:13px;padding:16px;max-width:300px}.row{display:flex;justify-content:space-between;margin:3px 0}hr{border:none;border-top:1px dashed #000;margin:8px 0}</style></head><body><h2 style="text-align:center">🍽️ RestoBill</h2><p style="text-align:center">** REPRINT **</p><hr/>${items}<hr/><div class="row"><b>TOTAL</b><b>₹${bill.total?.toFixed(2)}</b></div><hr/><p style="text-align:center">Thank you!</p></body></html>`);
    w.document.close(); setTimeout(() => w.print(), 300);
  }

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
            customerName: customerName || undefined,
            customerPhone: customerPhone || undefined,
            coverCount,
            isPriority,
            kotNote: kotNote || undefined,
            items: cart.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity, notes: i.notes })),
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        showToast("Order placed! KOT sent to kitchen.");
      }
      setShowNewOrder(false);
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
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
            + Takeaway
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setOrderType("DELIVERY"); setSelectedTable(null); setShowNewOrder(true); setCart([]); setActiveOrder(null); }}>
            🛵 Delivery
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
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #E2E8F0" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
                    {selectedTable ? `Table ${selectedTable.number}` : orderType === "DELIVERY" ? "🛵 Delivery" : "🥡 Takeaway"}
                    {selectedTable && <span style={{ fontSize:12, color:"#94A3B8", fontWeight:400, marginLeft:8 }}>Cap: {selectedTable.capacity}</span>}
                  </h3>
                  {activeOrder && <span style={{ fontSize: 12, color: "#E8721C" }}>Order #{activeOrder.orderNumber} active — adding items</span>}
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  {/* Cover count */}
                  {selectedTable && (
                    <div style={{ display:"flex", alignItems:"center", gap:5, background:"#F8FAFC", borderRadius:8, padding:"4px 10px", border:"1px solid #E2E8F0" }}>
                      <span style={{ fontSize:12, color:"#64748B" }}>👥</span>
                      <button onClick={()=>setCoverCount(c=>Math.max(1,c-1))} style={{ background:"none", border:"none", cursor:"pointer", fontSize:14, color:"#374151", padding:"0 2px" }}>−</button>
                      <span style={{ fontSize:13, fontWeight:700, minWidth:16, textAlign:"center" }}>{coverCount}</span>
                      <button onClick={()=>setCoverCount(c=>Math.min(selectedTable.capacity,c+1))} style={{ background:"none", border:"none", cursor:"pointer", fontSize:14, color:"#374151", padding:"0 2px" }}>+</button>
                    </div>
                  )}
                  {/* Priority */}
                  <button onClick={()=>setIsPriority(v=>!v)}
                    style={{ background:isPriority?"#FFF7ED":"#F8FAFC", border:`1px solid ${isPriority?"#E8721C":"#E2E8F0"}`,
                      borderRadius:8, padding:"5px 10px", cursor:"pointer", fontSize:12, fontWeight:700, color:isPriority?"#E8721C":"#94A3B8" }}>
                    {isPriority?"★ Priority":"☆ Priority"}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowNewOrder(false)}>✕</button>
                </div>
              </div>
              {/* KOT Note */}
              <input value={kotNote} onChange={e=>setKotNote(e.target.value)}
                placeholder="🗒 Kitchen note (optional) — e.g. less spicy, no onions…"
                style={{ marginTop:8, width:"100%", padding:"6px 10px", borderRadius:7, border:"1px solid #E2E8F0", fontSize:12, outline:"none", boxSizing:"border-box", color:"#374151" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", flex: 1, overflow: "hidden" }}>
              {/* Left: Menu */}
              <div style={{ padding: 16, overflowY: "auto", borderRight: "1px solid #E2E8F0" }}>
                {/* Search */}
                <input value={search} onChange={e=>setSearch(e.target.value)}
                  placeholder="🔍 Search items…"
                  style={{ width:"100%", padding:"7px 12px", borderRadius:8, border:"1px solid #E2E8F0", fontSize:13, outline:"none", marginBottom:10, boxSizing:"border-box" }} />
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
                {(orderType === "TAKEAWAY" || orderType === "DELIVERY") && !selectedTable && (
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid #253045", background: "#1A2232" }}>
                    <input className="form-input" placeholder="Customer Name" value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      style={{ marginBottom: 6, background: "#253045", border: "1px solid #3A4A62", color: "white", fontSize: 12 }} />
                    <input className="form-input" placeholder="Phone" value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      style={{ marginBottom: 6, background: "#253045", border: "1px solid #3A4A62", color: "white", fontSize: 12 }} />
                    {orderType === "DELIVERY" && (
                      <input className="form-input" placeholder="Delivery Address" value={customerAddress}
                        onChange={e => setCustomerAddress(e.target.value)}
                        style={{ background: "#253045", border: "1px solid #3A4A62", color: "white", fontSize: 12 }} />
                    )}
                  </div>
                )}
                <div className="bill-panel-header">
                  <h3>Current Order</h3>
                  <p>{cart.length} item{cart.length !== 1 ? "s" : ""} added</p>
                </div>
                <div className="bill-items">
                  {cart.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "30px 0", color: "#94A3B8", fontSize: 13 }}>Tap menu items to add them</div>
                  ) : (
                    cart.map((item) => (
                      <div key={item.menuItemId}>
                        <div className="bill-item">
                          <span className="bill-item-name">{item.name}</span>
                          <div className="bill-item-qty">
                            <button className="qty-btn" onClick={() => updateQty(item.menuItemId, -1)}>−</button>
                            <span style={{ fontSize: 13, fontWeight: 700, minWidth: 20, textAlign: "center" }}>{item.quantity}</span>
                            <button className="qty-btn" onClick={() => updateQty(item.menuItemId, 1)}>+</button>
                          </div>
                          <span className="bill-item-price">₹{(item.price * item.quantity).toFixed(2)}</span>
                          <button onClick={()=>setNoteTarget(noteTarget===item.menuItemId?null:item.menuItemId)}
                            style={{ background:"none",border:"none",cursor:"pointer",fontSize:12,color:item.notes?"#E8721C":"#CBD5E1",padding:"0 4px" }} title="Note">📝</button>
                        </div>
                        {noteTarget===item.menuItemId && (
                          <input value={item.notes??""} onChange={e=>updateItemNote(item.menuItemId,e.target.value)}
                            placeholder="Note (e.g. no onion)…"
                            style={{ width:"100%",padding:"4px 8px",fontSize:11,border:"1px solid #3A4A62",borderRadius:5,outline:"none",marginBottom:4,boxSizing:"border-box",background:"#253045",color:"white" }} />
                        )}
                      </div>
                    ))
                  )}
                </div>
                {/* Loyalty */}
                <div style={{ padding:"8px 16px",borderTop:"1px solid #253045",background:"#1E2D42" }}>
                  <div style={{ display:"flex",gap:6 }}>
                    <input value={loyaltyPhone} onChange={e=>setLoyaltyPhone(e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&searchLoyaltyCustomer()}
                      placeholder="⭐ Loyalty phone…"
                      style={{ flex:1,padding:"5px 8px",borderRadius:6,border:"1px solid #3A4A62",background:"#253045",color:"white",fontSize:11,outline:"none" }} />
                    <button onClick={searchLoyaltyCustomer} disabled={loyaltySearching}
                      style={{ background:"#E8721C",border:"none",borderRadius:6,padding:"5px 10px",color:"white",fontSize:11,cursor:"pointer",fontWeight:700 }}>
                      {loyaltySearching?"…":"Go"}
                    </button>
                  </div>
                  {loyaltyCustomer && (
                    <div style={{ marginTop:6,background:"#253045",borderRadius:7,padding:"6px 10px" }}>
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                        <span style={{ color:"#CBD5E1",fontSize:11 }}>{loyaltyCustomer.name}</span>
                        <span style={{ color:"#E8721C",fontWeight:800,fontSize:12 }}>{loyaltyCustomer.loyaltyPoints} pts</span>
                      </div>
                      {loyaltyDiscount>0
                        ? <div style={{ color:"#4ADE80",fontSize:11,marginTop:3 }}>✅ ₹{loyaltyDiscount} redeemed</div>
                        : loyaltyCustomer.loyaltyPoints>0 && (
                          <button onClick={()=>redeemLoyaltyPoints(Math.min(loyaltyCustomer.loyaltyPoints,Math.floor(total)))}
                            style={{ marginTop:4,width:"100%",padding:"3px 0",background:"none",border:"1px solid #E8721C",borderRadius:5,color:"#E8721C",fontSize:10,cursor:"pointer",fontWeight:700 }}>
                            Redeem {Math.min(loyaltyCustomer.loyaltyPoints,Math.floor(total))} pts = ₹{(Math.min(loyaltyCustomer.loyaltyPoints,Math.floor(total))*0.1).toFixed(0)} off
                          </button>
                        )
                      }
                    </div>
                  )}
                </div>
                <div className="bill-footer">
                  <div className="bill-row"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                  <div className="bill-row" style={{ alignItems:"center",flexDirection:"column",gap:4 }}>
                    <div style={{ display:"flex",justifyContent:"space-between",width:"100%" }}>
                      <span>Discount</span>
                      <input type="number" min="0" value={discount} onChange={(e)=>setDiscount(Number(e.target.value))} style={{ width:70,padding:"2px 8px",border:"1px solid #E2E8F0",borderRadius:6,fontSize:12,textAlign:"right" }} />
                    </div>
                    {discounts.length>0 && (
                      <select className="form-select" style={{ fontSize:11,padding:"2px 6px" }}
                        onChange={e=>{ const d=discounts.find(x=>x.id===e.target.value); if(d) setDiscount(d.type==="PERCENT"?parseFloat(((subtotal*d.value)/100).toFixed(2)):d.value); }}>
                        <option value="">Quick discounts</option>
                        {discounts.map(d=><option key={d.id} value={d.id}>{d.name} ({d.type==="PERCENT"?`${d.value}%`:`₹${d.value}`})</option>)}
                      </select>
                    )}
                  </div>
                  {loyaltyDiscount>0 && <div className="bill-row" style={{ color:"#4ADE80" }}><span>Loyalty</span><span>−₹{loyaltyDiscount.toFixed(2)}</span></div>}
                  <div className="bill-row"><span>CGST (2.5%)</span><span>₹{cgst.toFixed(2)}</span></div>
                  <div className="bill-row"><span>SGST (2.5%)</span><span>₹{sgst.toFixed(2)}</span></div>
                  <div className="bill-row total"><span>TOTAL</span><span>₹{total.toFixed(2)}</span></div>
                  {/* Quick pay */}
                  <div style={{ marginTop:6,paddingTop:6,borderTop:"1px solid #253045" }}>
                    <div style={{ display:"flex",gap:6,alignItems:"center",marginBottom:4 }}>
                      <span style={{ fontSize:11,color:"#94A3B8" }}>💵</span>
                      <input type="number" min={0} value={cashTendered}
                        onChange={e=>setCashTendered(e.target.value===""?"":parseFloat(e.target.value))}
                        placeholder={`Cash ≥ ₹${total.toFixed(0)}`}
                        style={{ flex:1,padding:"4px 8px",borderRadius:6,border:"1px solid #3A4A62",background:"#253045",color:"white",fontSize:11,outline:"none",textAlign:"right" }} />
                    </div>
                    {typeof cashTendered==="number" && cashTendered>=total && (
                      <div style={{ display:"flex",justifyContent:"space-between",color:"#4ADE80",fontWeight:700,fontSize:13,marginBottom:4 }}>
                        <span>Change</span><span>₹{(cashTendered-total).toFixed(2)}</span>
                      </div>
                    )}
                    {typeof cashTendered==="number" && cashTendered>0 && cashTendered<total && (
                      <div style={{ color:"#FCA5A5",fontSize:11,marginBottom:4 }}>⚠ Short ₹{(total-cashTendered).toFixed(2)}</div>
                    )}
                    <div style={{ display:"flex",gap:3 }}>
                      {[100,200,500,1000].filter(v=>v>=total).slice(0,3).map(v=>(
                        <button key={v} onClick={()=>setCashTendered(v)}
                          style={{ flex:1,padding:"2px",background:"#253045",border:"1px solid #3A4A62",borderRadius:4,color:"#94A3B8",fontSize:10,cursor:"pointer" }}>₹{v}</button>
                      ))}
                      <button onClick={()=>setCashTendered(Math.ceil(total/10)*10)}
                        style={{ flex:1,padding:"2px",background:"#253045",border:"1px solid #E8721C",borderRadius:4,color:"#E8721C",fontSize:10,cursor:"pointer",fontWeight:700 }}>Exact</button>
                    </div>
                  </div>
                  <div style={{ marginTop:10,display:"flex",flexDirection:"column",gap:8 }}>
                    <button className="btn btn-primary" style={{ justifyContent:"center" }} onClick={placeOrder} disabled={loading||cart.length===0}>
                      {loading?"Placing…":activeOrder?"🍳 Add to KOT":`🍳 KOT${isPriority?" ★":""}`}
                    </button>
                    {activeOrder && !activeOrder.bill && (
                      <button className="btn btn-success" style={{ justifyContent:"center" }} onClick={generateBill} disabled={loading}>🧾 Generate Bill</button>
                    )}
                    {activeOrder?.bill && (
                      <button className="btn btn-ghost" style={{ justifyContent:"center" }} onClick={()=>reprintBill(activeOrder)}>🖨️ Reprint Bill</button>
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
