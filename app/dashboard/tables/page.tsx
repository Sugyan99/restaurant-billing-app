"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { showToast } from "@/components/Toast";

type Table = {
  id: string; number: string; capacity: number; status: "FREE" | "OCCUPIED" | "RESERVED";
  posX: number; posY: number; shape: string; section: string; mergedWith: string | null;
  orders: Order[];
};
type WaitlistEntry = { id: string; customerName: string; customerPhone: string; partySize: number; estimatedWait: number | null; notes: string | null; status: string; createdAt: string; };
type Reservation = { id: string; customerName: string; customerPhone: string; partySize: number; date: string; tableId: string | null; status: string; notes: string | null; };
const GRID = 90; const CANVAS_W = 1800; const CANVAS_H = 960;
const SECTIONS = ["All", "Main Hall", "Terrace", "Private", "Bar"];
const S_CFG = { FREE: { bg: "#22c55e22", border: "#22c55e", text: "#4ade80", dot: "#22c55e" }, OCCUPIED: { bg: "#ef444422", border: "#ef4444", text: "#f87171", dot: "#ef4444" }, RESERVED: { bg: "#f59e0b22", border: "#f59e0b", text: "#fbbf24", dot: "#f59e0b" } } as const;
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
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [editNum, setEditNum] = useState("");
  const [editCap, setEditCap] = useState(4);
  const [editSection, setEditSection] = useState("Main Hall");
  const [editShape, setEditShape] = useState("square");
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
  // View toggle
  const [view, setView] = useState<"grid" | "floor">("grid");
  // Floor-specific state
  const [floorMode, setFloorMode] = useState<"view" | "drag" | "merge" | "transfer">("view");
  const [mergeSource, setMergeSource] = useState<Table | null>(null);
  const [transferSource, setTransferSource] = useState<Table | null>(null);
  const [floorSection, setFloorSection] = useState("All");
  const [floorPanel, setFloorPanel] = useState<"none" | "waitlist" | "reservations">("none");
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [showWaitlistForm, setShowWaitlistForm] = useState(false);
  const [showResForm, setShowResForm] = useState(false);
  const dragging = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);

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
    const loadFloor = () => {
      fetch("/api/waitlist").then(r => r.json()).then(d => setWaitlist(d.waitlist ?? []));
      fetch("/api/reservations").then(r => r.json()).then(d => setReservations(d.reservations ?? []));
    };
    loadFloor();
    const interval = setInterval(() => { loadTables(); loadFloor(); }, 15000);
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

  function openEditTable(e: React.MouseEvent, table: Table) {
    e.stopPropagation();
    setEditingTable(table);
    setEditNum(table.number);
    setEditCap(table.capacity);
    setEditSection(table.section ?? "Main Hall");
    setEditShape(table.shape ?? "square");
  }

  async function saveEditTable() {
    if (!editingTable || !editNum.trim()) return;
    const res = await fetch(`/api/tables/${editingTable.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: editNum.trim(), capacity: editCap, section: editSection, shape: editShape }),
    });
    if (res.ok) { showToast("Table updated"); setEditingTable(null); loadTables(); }
    else { const d = await res.json(); showToast(d.error ?? "Update failed", "error"); }
  }

  async function deleteTable(table: Table) {
    if (!confirm(`Delete Table ${table.number}? This cannot be undone.`)) return;
    const res = await fetch(`/api/tables/${table.id}`, { method: "DELETE" });
    if (res.ok) { showToast(`Table ${table.number} deleted`); setEditingTable(null); loadTables(); }
    else { const d = await res.json(); showToast(d.error ?? "Delete failed", "error"); }
  }

  // ── Floor helpers ────────────────────────────────────────────────────────
  async function doMerge(primary: Table, secondary: Table) {
    const r = await fetch("/api/tables/merge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ primaryTableId: primary.id, secondaryTableId: secondary.id }) });
    if (r.ok) { showToast(`T${secondary.number} merged with T${primary.number}`, "success"); setMergeSource(null); setFloorMode("view"); loadTables(); }
    else showToast("Merge failed", "error");
  }
  async function doSplit(table: Table) {
    const r = await fetch("/api/tables/merge", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tableId: table.id }) });
    if (r.ok) { showToast(`T${table.number} split`, "success"); loadTables(); }
    else showToast("Split failed", "error");
  }
  async function doTransfer(from: Table, to: Table) {
    const r = await fetch("/api/tables/transfer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fromTableId: from.id, toTableId: to.id }) });
    if (r.ok) { showToast(`Order → T${to.number}`, "success"); setTransferSource(null); setFloorMode("view"); loadTables(); }
    else { const d = await r.json(); showToast(d.error ?? "Failed", "error"); }
  }
  function onFloorTableClick(table: Table) {
    if (floorMode === "drag") return;
    if (floorMode === "merge") {
      if (!mergeSource) { setMergeSource(table); return; }
      if (mergeSource.id === table.id) { setMergeSource(null); return; }
      doMerge(mergeSource, table); return;
    }
    if (floorMode === "transfer") {
      if (!transferSource) {
        if (table.status !== "OCCUPIED") { showToast("Select occupied table first", "error"); return; }
        setTransferSource(table); return;
      }
      if (transferSource.id === table.id) { setTransferSource(null); return; }
      doTransfer(transferSource, table); return;
    }
    openTable(table);
  }
  function onDragStart(e: React.MouseEvent, t: Table) {
    if (floorMode !== "drag") return;
    e.preventDefault();
    dragging.current = { id: t.id, sx: e.clientX, sy: e.clientY, ox: t.posX, oy: t.posY };
  }
  function onDragMove(e: React.MouseEvent) {
    if (!dragging.current || floorMode !== "drag") return;
    const nx = Math.max(0, Math.min(CANVAS_W - GRID, dragging.current.ox + e.clientX - dragging.current.sx));
    const ny = Math.max(0, Math.min(CANVAS_H - GRID, dragging.current.oy + e.clientY - dragging.current.sy));
    setTables(prev => prev.map(t => t.id === dragging.current!.id ? { ...t, posX: nx, posY: ny } : t));
  }
  async function onDragEnd() {
    if (!dragging.current || floorMode !== "drag") return;
    const { id } = dragging.current; dragging.current = null;
    const t = tables.find(x => x.id === id); if (!t) return;
    const sx = Math.round(t.posX / GRID) * GRID, sy = Math.round(t.posY / GRID) * GRID;
    setTables(prev => prev.map(x => x.id === id ? { ...x, posX: sx, posY: sy } : x));
    await fetch(`/api/tables/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ posX: sx, posY: sy }) });
  }

  const visibleTables = tables.filter(t => floorSection === "All" || t.section === floorSection);
  const todayRes = reservations.filter(r => new Date(r.date).toDateString() === new Date().toDateString());

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden", flex: 1 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Tables & POS</h2>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>
              {tables.filter(t => t.status === "FREE").length} free · {tables.filter(t => t.status === "OCCUPIED").length} occupied · {tables.filter(t => t.status === "RESERVED").length} reserved
            </p>
          </div>
          {/* View toggle */}
          <div style={{ display: "flex", background: "#F1F5F9", borderRadius: 8, padding: 3, gap: 2 }}>
            <button onClick={() => setView("grid")} style={{ padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, background: view === "grid" ? "white" : "transparent", color: view === "grid" ? "#1E293B" : "#94A3B8", boxShadow: view === "grid" ? "0 1px 3px #0001" : "none" }}>⊞ Grid</button>
            <button onClick={() => setView("floor")} style={{ padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, background: view === "floor" ? "white" : "transparent", color: view === "floor" ? "#1E293B" : "#94A3B8", boxShadow: view === "floor" ? "0 1px 3px #0001" : "none" }}>🗺 Floor Plan</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => { setOrderType("TAKEAWAY"); setSelectedTable(null); setShowNewOrder(true); setCart([]); setActiveOrder(null); }}>+ Takeaway</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setOrderType("DELIVERY"); setSelectedTable(null); setShowNewOrder(true); setCart([]); setActiveOrder(null); }}>🛵 Delivery</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddTable(true)}>+ Add Table</button>
        </div>
      </div>

      {/* ── FLOOR PLAN VIEW ───────────────────────────────────────────────── */}
      {view === "floor" && (
        <div style={{ display: "flex", flexDirection: "column", background: "#0F172A", borderRadius: 12, overflow: "hidden", height: "calc(100vh - 130px)", maxHeight: "calc(100vh - 130px)" }}>
          {/* Floor toolbar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#1E293B", borderBottom: "1px solid #334155", flexWrap: "wrap" }}>
            {/* Stats */}
            <div style={{ display: "flex", gap: 10, fontSize: 12 }}>
              {[["Free", tables.filter(t=>t.status==="FREE").length, "#4ade80"], ["Occupied", tables.filter(t=>t.status==="OCCUPIED").length, "#f87171"], ["Reserved", tables.filter(t=>t.status==="RESERVED").length, "#fbbf24"]].map(([l,v,c])=>(
                <span key={l as string} style={{ color: c as string, fontWeight: 700 }}>{v} <span style={{ color: "#64748B", fontWeight: 400 }}>{l}</span></span>
              ))}
            </div>
            <div style={{ width: 1, height: 20, background: "#334155" }} />
            {/* Section filter */}
            <div style={{ display: "flex", gap: 4 }}>
              {SECTIONS.map(s => (
                <button key={s} onClick={() => setFloorSection(s)} style={{ padding: "3px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, background: floorSection === s ? "#6366F1" : "#1E293B", color: floorSection === s ? "white" : "#64748B" }}>{s}</button>
              ))}
            </div>
            <div style={{ width: 1, height: 20, background: "#334155" }} />
            {/* Mode buttons */}
            {([["view","👁 View"],["drag","✋ Move"],["merge","🔗 Merge"],["transfer","↔ Transfer"]] as const).map(([m,l])=>(
              <button key={m} onClick={() => { setFloorMode(m); setMergeSource(null); setTransferSource(null); }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, background: floorMode === m ? "#6366F1" : "transparent", color: floorMode === m ? "white" : "#64748B" }}>{l}</button>
            ))}
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <button onClick={() => setFloorPanel(floorPanel === "waitlist" ? "none" : "waitlist")} style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, background: floorPanel === "waitlist" ? "#7C3AED" : "#1E293B", color: floorPanel === "waitlist" ? "white" : "#94A3B8", position: "relative" }}>
                ⏳ Waitlist {waitlist.length > 0 && <span style={{ background: "#7C3AED", color: "white", borderRadius: "50%", fontSize: 9, padding: "1px 5px", marginLeft: 4 }}>{waitlist.length}</span>}
              </button>
              <button onClick={() => setFloorPanel(floorPanel === "reservations" ? "none" : "reservations")} style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, background: floorPanel === "reservations" ? "#B45309" : "#1E293B", color: floorPanel === "reservations" ? "white" : "#94A3B8" }}>
                📅 Reservations {todayRes.length > 0 && <span style={{ background: "#B45309", color: "white", borderRadius: "50%", fontSize: 9, padding: "1px 5px", marginLeft: 4 }}>{todayRes.length}</span>}
              </button>
            </div>
          </div>
          {/* Mode banner */}
          {floorMode !== "view" && (
            <div style={{ textAlign: "center", padding: "6px", fontSize: 12, fontWeight: 600, background: "#312E81", color: "#A5B4FC" }}>
              {floorMode === "drag" && "✋ Drag tables to reposition — auto-saves on drop"}
              {floorMode === "merge" && (!mergeSource ? "🔗 Click the PRIMARY table first" : `🔗 Now click a table to merge with T${mergeSource.number}`)}
              {floorMode === "transfer" && (!transferSource ? "↔ Click an OCCUPIED table to move its order" : `↔ Now click destination table for T${transferSource.number}`)}
            </div>
          )}
          {/* Canvas + Side Panel */}
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            {/* Canvas */}
            <div style={{ flex: 1, overflow: "auto" }}>
              <div style={{ position: "relative", width: CANVAS_W, height: CANVAS_H, backgroundImage: "radial-gradient(circle, #ffffff0a 1px, transparent 1px)", backgroundSize: `${GRID}px ${GRID}px` }}
                onMouseMove={onDragMove} onMouseUp={onDragEnd} onMouseLeave={onDragEnd}>
                {visibleTables.map(table => {
                  const cfg = S_CFG[table.status];
                  const isMSrc = mergeSource?.id === table.id, isTSrc = transferSource?.id === table.id;
                  const isRound = table.shape === "round";
                  const itemCount = table.orders?.reduce((s, o) => s + (o as any).items?.reduce((s2: number, i: any) => s2 + i.quantity, 0) || 0, 0) ?? 0;
                  const mergedLabel = table.mergedWith ? tables.find(t => t.id === table.mergedWith)?.number : null;
                  return (
                    <div key={table.id} style={{ position: "absolute", left: table.posX, top: table.posY, width: GRID, height: GRID, cursor: floorMode === "drag" ? "grab" : "pointer", transition: "left 0.05s, top 0.05s" }}
                      onMouseDown={e => onDragStart(e, table)} onClick={() => onFloorTableClick(table)}>
                      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: cfg.bg, border: `2px solid ${isMSrc || isTSrc ? "#A78BFA" : cfg.border}`, borderRadius: isRound ? "50%" : 12, boxShadow: isMSrc || isTSrc ? "0 0 16px #A78BFA88" : `0 0 12px ${cfg.dot}33`, transition: "all 0.2s", transform: isMSrc || isTSrc ? "scale(1.08)" : "scale(1)" }}>
                        {table.mergedWith && <div style={{ position: "absolute", top: -6, left: -6, background: "#7C3AED", color: "white", fontSize: 9, borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>M</div>}
                        <button onClick={e => { e.stopPropagation(); openEditTable(e, table); }} style={{ position: "absolute", top: 3, right: 4, background: "none", border: "none", cursor: "pointer", fontSize: 10, opacity: 0.5, padding: 0, lineHeight: 1, color: "white" }} title="Edit table">✏️</button>
                        <div style={{ color: cfg.dot, fontWeight: 900, fontSize: 16 }}>{table.number}</div>
                        <div style={{ display: "flex", gap: 1, marginTop: 2 }}>
                          {Array.from({ length: Math.min(table.capacity, 4) }).map((_, i) => <span key={i} style={{ fontSize: 8 }}>🪑</span>)}
                          {table.capacity > 4 && <span style={{ fontSize: 8, color: "#64748B" }}>+{table.capacity - 4}</span>}
                        </div>
                        {itemCount > 0 && <div style={{ position: "absolute", bottom: -8, background: "#F97316", color: "white", fontSize: 9, borderRadius: 10, padding: "1px 6px", fontWeight: 700 }}>{itemCount} items</div>}
                        {mergedLabel && <div style={{ position: "absolute", bottom: -18, fontSize: 9, color: "#A78BFA" }}>+T{mergedLabel}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Side panel */}
            {floorPanel !== "none" && (
              <div style={{ width: 280, background: "#1E293B", borderLeft: "1px solid #334155", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: "1px solid #334155" }}>
                  <span style={{ fontWeight: 700, color: "white", fontSize: 13 }}>{floorPanel === "waitlist" ? "⏳ Waitlist" : "📅 Today's Reservations"}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => floorPanel === "waitlist" ? setShowWaitlistForm(true) : setShowResForm(true)} style={{ background: "#6366F1", border: "none", borderRadius: 6, padding: "3px 8px", color: "white", fontSize: 11, cursor: "pointer" }}>+ Add</button>
                    <button onClick={() => setFloorPanel("none")} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: 14 }}>✕</button>
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
                  {floorPanel === "waitlist" && (waitlist.length === 0 ? <p style={{ color: "#475569", fontSize: 13, textAlign: "center", marginTop: 40 }}>Waitlist is empty</p> :
                    waitlist.map((w, i) => {
                      const waited = Math.floor((Date.now() - new Date(w.createdAt).getTime()) / 60000);
                      return <div key={w.id} style={{ background: "#0F172A", borderRadius: 8, padding: 10, marginBottom: 8, border: "1px solid #334155" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#7C3AED", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{i+1}</div>
                            <div>
                              <div style={{ color: "white", fontWeight: 700, fontSize: 13 }}>{w.customerName}</div>
                              <div style={{ color: "#64748B", fontSize: 11 }}>{w.partySize} guests · {w.customerPhone}</div>
                              <div style={{ fontSize: 11, color: waited > (w.estimatedWait ?? 15) ? "#f87171" : "#4ade80" }}>Waited {waited}m{w.estimatedWait ? ` / ~${w.estimatedWait}m` : ""}</div>
                            </div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <button onClick={async()=>{ await fetch(`/api/waitlist/${w.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"SEATED"})}); fetch("/api/waitlist").then(r=>r.json()).then(d=>setWaitlist(d.waitlist??[])); }} style={{ background: "#16a34a", border: "none", borderRadius: 5, padding: "2px 8px", color: "white", fontSize: 10, cursor: "pointer" }}>Seat</button>
                            <button onClick={async()=>{ await fetch(`/api/waitlist/${w.id}`,{method:"DELETE"}); fetch("/api/waitlist").then(r=>r.json()).then(d=>setWaitlist(d.waitlist??[])); }} style={{ background: "#334155", border: "none", borderRadius: 5, padding: "2px 8px", color: "#94A3B8", fontSize: 10, cursor: "pointer" }}>✕</button>
                          </div>
                        </div>
                        {w.notes && <div style={{ color: "#64748B", fontSize: 11, marginTop: 4, fontStyle: "italic" }}>{w.notes}</div>}
                      </div>;
                    })
                  )}
                  {floorPanel === "reservations" && (todayRes.length === 0 ? <p style={{ color: "#475569", fontSize: 13, textAlign: "center", marginTop: 40 }}>No reservations today</p> :
                    todayRes.map(r => <div key={r.id} style={{ background: "#0F172A", borderRadius: 8, padding: 10, marginBottom: 8, border: "1px solid #334155" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ color: "white", fontWeight: 700, fontSize: 13 }}>{r.customerName}</div>
                          <div style={{ color: "#64748B", fontSize: 11 }}>{r.customerPhone} · {r.partySize} guests</div>
                          <div style={{ color: "#fbbf24", fontSize: 11, marginTop: 3 }}>{new Date(r.date).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})} {r.tableId && `· T${tables.find(t=>t.id===r.tableId)?.number??""}`}</div>
                          {r.notes && <div style={{ color: "#64748B", fontSize: 11, fontStyle: "italic" }}>{r.notes}</div>}
                        </div>
                        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: r.status==="CONFIRMED"?"#14532d":"#334155", color: r.status==="CONFIRMED"?"#4ade80":"#94A3B8", fontWeight: 700, height: "fit-content" }}>{r.status}</span>
                      </div>
                    </div>)
                  )}
                </div>
              </div>
            )}
          </div>
          {/* Waitlist quick-add modal */}
          {showWaitlistForm && <WaitlistModal onClose={()=>setShowWaitlistForm(false)} onSave={()=>{ fetch("/api/waitlist").then(r=>r.json()).then(d=>setWaitlist(d.waitlist??[])); setShowWaitlistForm(false); }} />}
          {showResForm && <ReservationModal tables={tables} onClose={()=>setShowResForm(false)} onSave={()=>{ fetch("/api/reservations").then(r=>r.json()).then(d=>setReservations(d.reservations??[])); setShowResForm(false); }} />}
        </div>
      )}

      {/* ── GRID VIEW ────────────────────────────────────────────────────────── */}
      {view === "grid" && <>
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
            <div key={table.id} className={`table-card ${table.status.toLowerCase()}`} onClick={() => openTable(table)} style={{ position: "relative" }}>
              <button onClick={(e) => openEditTable(e, table)} title="Edit table"
                style={{ position: "absolute", top: 6, right: 6, background: "none", border: "none", cursor: "pointer", fontSize: 13, opacity: 0.4, padding: 2, lineHeight: 1 }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "0.4")}>
                ✏️
              </button>
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
      </>}

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

      {/* Edit Table Modal */}
      {editingTable && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEditingTable(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <h3 className="modal-title">✏️ Edit Table {editingTable.number}</h3>
            <div className="form-group">
              <label className="form-label">Table Name / Number</label>
              <input className="form-input" value={editNum} onChange={e => setEditNum(e.target.value)}
                onKeyDown={e => e.key === "Enter" && saveEditTable()} autoFocus />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="form-group">
                <label className="form-label">Capacity</label>
                <input type="number" className="form-input" min={1} max={20} value={editCap} onChange={e => setEditCap(+e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Shape</label>
                <select className="form-input" value={editShape} onChange={e => setEditShape(e.target.value)}>
                  <option value="square">Square</option>
                  <option value="round">Round</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Section</label>
              <select className="form-input" value={editSection} onChange={e => setEditSection(e.target.value)}>
                {["Main Hall", "Terrace", "Private", "Bar"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 4 }}>
              <button className="btn btn-ghost" style={{ color: "#ef4444", borderColor: "#ef4444" }}
                onClick={() => deleteTable(editingTable)}
                disabled={editingTable.status === "OCCUPIED"} title={editingTable.status === "OCCUPIED" ? "Cannot delete — table has active order" : "Delete table"}>
                🗑 Delete
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => setEditingTable(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={saveEditTable} disabled={!editNum.trim()}>Save</button>
              </div>
            </div>
            {editingTable.status === "OCCUPIED" && (
              <p style={{ fontSize: 11, color: "#f59e0b", marginTop: 8, textAlign: "center" }}>⚠ Table has active order — delete disabled</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Waitlist Modal ────────────────────────────────────────────────────────────
function WaitlistModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [party, setParty] = useState(2); const [wait, setWait] = useState(15);
  const [notes, setNotes] = useState(""); const [saving, setSaving] = useState(false);
  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const r = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerName: name, customerPhone: phone, partySize: party, estimatedWait: wait, notes }) });
    if (r.ok) onSave(); else showToast("Failed to add to waitlist", "error");
    setSaving(false);
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <h3 className="modal-title">⏳ Add to Waitlist</h3>
        <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Customer name" /></div>
        <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="form-group"><label className="form-label">Party Size</label><input type="number" className="form-input" min={1} max={20} value={party} onChange={e => setParty(+e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Est. Wait (min)</label><input type="number" className="form-input" min={5} max={120} value={wait} onChange={e => setWait(+e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Special requirements..." style={{ resize: "none" }} /></div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !name.trim()}>{saving ? "Adding…" : "Add to Waitlist"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Reservation Modal ────────────────────────────────────────────────────────
function ReservationModal({ tables, onClose, onSave }: { tables: { id: string; number: string; capacity: number; status: string }[]; onClose: () => void; onSave: () => void }) {
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [party, setParty] = useState(2); const [tableId, setTableId] = useState("");
  const [date, setDate] = useState(""); const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!name.trim() || !date) return;
    setSaving(true);
    const r = await fetch("/api/reservations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerName: name, customerPhone: phone, partySize: party, tableId: tableId || null, date, notes }) });
    if (r.ok) onSave(); else showToast("Failed to create reservation", "error");
    setSaving(false);
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <h3 className="modal-title">📅 New Reservation</h3>
        <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Customer name" /></div>
        <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="form-group"><label className="form-label">Party Size</label><input type="number" className="form-input" min={1} max={20} value={party} onChange={e => setParty(+e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Table</label>
            <select className="form-input" value={tableId} onChange={e => setTableId(e.target.value)}>
              <option value="">Any Table</option>
              {tables.filter(t => t.status === "FREE").map(t => <option key={t.id} value={t.id}>Table {t.number} ({t.capacity})</option>)}
            </select>
          </div>
        </div>
        <div className="form-group"><label className="form-label">Date & Time *</label><input type="datetime-local" className="form-input" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Special requirements..." style={{ resize: "none" }} /></div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !name.trim() || !date}>{saving ? "Saving…" : "Create Reservation"}</button>
        </div>
      </div>
    </div>
  );
}
