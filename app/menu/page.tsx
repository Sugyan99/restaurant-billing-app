"use client";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type Item = {
  id: string; name: string; description?: string;
  price: number; isVeg: boolean; imageUrl?: string; taxRate?: number;
};
type Category = { id: string; name: string; items: Item[] };
type CartEntry = { item: Item; qty: number; notes: string };
type RestaurantInfo = { restaurantName: string; address?: string; phone?: string; receiptHeader?: string };

const VEG = () => (
  <span style={{ border: "2px solid #16A34A", borderRadius: 3, padding: "1px 3px", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16 }}>
    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16A34A", display: "block" }} />
  </span>
);
const NVEG = () => (
  <span style={{ border: "2px solid #DC2626", borderRadius: 3, padding: "1px 3px", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16 }}>
    <span style={{ width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderBottom: "8px solid #DC2626", display: "block" }} />
  </span>
);

function MenuContent() {
  const params     = useSearchParams();
  const router     = useRouter();
  const tableNum   = params.get("table") ?? "";
  const [info, setInfo]         = useState<RestaurantInfo | null>(null);
  const [categories, setCats]   = useState<Category[]>([]);
  const [cart, setCart]         = useState<Map<string, CartEntry>>(new Map());
  const [activeTab, setTab]     = useState<string>("");
  const [search, setSearch]     = useState("");
  const [showCart, setShowCart] = useState(false);
  const [loading, setLoading]   = useState(true);
  const [submitting, setSub]    = useState(false);
  const [form, setForm]         = useState({ name: "", phone: "", notes: "" });
  const [step, setStep]         = useState<"menu" | "checkout" | "done">("menu");
  const [orderId, setOrderId]   = useState("");
  const catRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    fetch("/api/qr/menu")
      .then((r) => r.json())
      .then((d) => {
        setInfo(d.settings);
        setCats(d.categories ?? []);
        if (d.categories?.length) setTab(d.categories[0].id);
        setLoading(false);
      });
  }, []);

  const addItem = useCallback((item: Item) => {
    setCart((prev) => {
      const next = new Map(prev);
      const e    = next.get(item.id);
      next.set(item.id, { item, qty: (e?.qty ?? 0) + 1, notes: e?.notes ?? "" });
      return next;
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      const e    = next.get(id);
      if (!e || e.qty <= 1) next.delete(id);
      else next.set(id, { ...e, qty: e.qty - 1 });
      return next;
    });
  }, []);

  const totalItems = Array.from(cart.values()).reduce((s, e) => s + e.qty, 0);
  const totalPrice = Array.from(cart.values()).reduce((s, e) => s + e.item.price * e.qty, 0);

  const filteredCats = categories.map((c) => ({
    ...c,
    items: search ? c.items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase())) : c.items,
  })).filter((c) => c.items.length > 0);

  async function placeOrder() {
    if (!form.name.trim()) return alert("Please enter your name");
    if (!form.phone.trim() || form.phone.trim().length < 10) return alert("Please enter a valid phone number (10 digits)");
    if (cart.size === 0) return alert("Cart is empty");
    setSub(true);
    const items = Array.from(cart.values()).map((e) => ({
      menuItemId: e.item.id, quantity: e.qty, notes: e.notes || undefined,
    }));
    const res = await fetch("/api/qr/order", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ tableNumber: tableNum, customerName: form.name, customerPhone: form.phone, notes: form.notes, items }),
    });
    const data = await res.json();
    setSub(false);
    if (!res.ok) return alert(data.error ?? "Failed to place order");
    setOrderId(data.id);
    setStep("done");
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", flexDirection: "column", gap: 12 }}>
      <div style={{ width: 40, height: 40, border: "3px solid #E8721C", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <p style={{ color: "#94A3B8", fontSize: 14 }}>Loading menu…</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!tableNum) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24, textAlign: "center" }}>
      <div>
        <div style={{ fontSize: 48 }}>🔗</div>
        <h2 style={{ color: "#0F1623", marginTop: 12 }}>Invalid QR Code</h2>
        <p style={{ color: "#94A3B8" }}>Please scan the QR code on your table.</p>
      </div>
    </div>
  );

  if (step === "done") {
    router.push(`/menu/status/${orderId}?table=${tableNum}`);
    return null;
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#FFFBF7", fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#0F1623", color: "white", padding: "16px 20px", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#E8721C" }}>{info?.restaurantName ?? "Restaurant"}</h1>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94A3B8" }}>Table {tableNum} · Scan &amp; Order</p>
          </div>
          {totalItems > 0 && (
            <button onClick={() => { setShowCart(true); setStep("checkout"); }} style={{ background: "#E8721C", color: "white", border: "none", borderRadius: 20, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              🛒 {totalItems} · ₹{totalPrice.toFixed(0)}
            </button>
          )}
        </div>
        {/* Search */}
        <div style={{ marginTop: 12, position: "relative" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14 }}>🔍</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search dishes…"
            style={{ width: "100%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 12px 8px 32px", color: "white", fontSize: 13, outline: "none" }} />
        </div>
      </div>

      {/* Category tabs */}
      {!search && (
        <div style={{ display: "flex", overflowX: "auto", gap: 8, padding: "10px 16px", background: "white", borderBottom: "1px solid #E2E8F0", position: "sticky", top: 88, zIndex: 40 }}>
          {categories.map((c) => (
            <button key={c.id} onClick={() => { setTab(c.id); catRefs.current[c.id]?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
              style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: "none", fontWeight: 600, fontSize: 12, cursor: "pointer", background: activeTab === c.id ? "#E8721C" : "#F1F5F9", color: activeTab === c.id ? "white" : "#64748B", transition: "all 0.15s" }}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Menu items */}
      <div style={{ padding: "12px 16px 100px" }}>
        {filteredCats.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
            <div style={{ fontSize: 40 }}>🍽️</div>
            <p style={{ marginTop: 12 }}>No items found</p>
          </div>
        ) : filteredCats.map((cat) => (
          <div key={cat.id} ref={(el) => { catRefs.current[cat.id] = el; }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: "#64748B", letterSpacing: 1, textTransform: "uppercase", margin: "20px 0 10px", padding: "0 0 8px", borderBottom: "2px solid #F1F5F9" }}>
              {cat.name}
            </h3>
            {cat.items.map((item) => {
              const entry = cart.get(item.id);
              return (
                <div key={item.id} style={{ background: "white", borderRadius: 12, border: "1px solid #E2E8F0", marginBottom: 10, overflow: "hidden", display: "flex" }}>
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt={item.name} style={{ width: 90, height: 90, objectFit: "cover", flexShrink: 0 }} />
                  )}
                  <div style={{ padding: "12px 14px", flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      {item.isVeg ? <VEG /> : <NVEG />}
                      <span style={{ fontWeight: 700, fontSize: 14, color: "#0F1623" }}>{item.name}</span>
                    </div>
                    {item.description && (
                      <p style={{ margin: "0 0 6px", fontSize: 12, color: "#94A3B8", lineHeight: 1.4 }}>{item.description}</p>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 800, fontSize: 15, color: "#E8721C" }}>₹{item.price.toFixed(0)}</span>
                      {!entry ? (
                        <button onClick={() => addItem(item)}
                          style={{ background: "#E8721C", color: "white", border: "none", borderRadius: 8, padding: "6px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                          ADD
                        </button>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <button onClick={() => removeItem(item.id)} style={{ width: 30, height: 30, borderRadius: 8, border: "1.5px solid #E8721C", background: "white", color: "#E8721C", fontWeight: 800, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                          <span style={{ fontWeight: 800, fontSize: 15, minWidth: 18, textAlign: "center" }}>{entry.qty}</span>
                          <button onClick={() => addItem(item)} style={{ width: 30, height: 30, borderRadius: 8, background: "#E8721C", border: "none", color: "white", fontWeight: 800, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Sticky cart bar */}
      {totalItems > 0 && step === "menu" && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 60, padding: "12px 16px", background: "white", borderTop: "1px solid #E2E8F0", maxWidth: 480, margin: "0 auto" }}>
          <button onClick={() => setStep("checkout")} style={{ width: "100%", background: "#E8721C", color: "white", border: "none", borderRadius: 12, padding: "14px", fontWeight: 800, fontSize: 15, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>🛒 {totalItems} item{totalItems > 1 ? "s" : ""}</span>
            <span>View Cart · ₹{totalPrice.toFixed(0)}</span>
          </button>
        </div>
      )}

      {/* Checkout overlay */}
      {step === "checkout" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", animation: "slideUp 0.25s ease", padding: "0 0 24px" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "white" }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Your Order</h2>
              <button onClick={() => setStep("menu")} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#94A3B8" }}>✕</button>
            </div>

            <div style={{ padding: "12px 20px" }}>
              {/* Cart items */}
              {Array.from(cart.values()).map(({ item, qty, notes }) => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid #F1F5F9" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {item.isVeg ? <VEG /> : <NVEG />}
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</span>
                    </div>
                    <input value={notes} onChange={(e) => setCart((prev) => { const next = new Map(prev); next.set(item.id, { item, qty, notes: e.target.value }); return next; })}
                      placeholder="Add note (e.g. less spicy)…"
                      style={{ marginTop: 4, width: "100%", border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 8px", fontSize: 12, color: "#64748B", outline: "none" }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button onClick={() => removeItem(item.id)} style={{ width: 26, height: 26, borderRadius: 6, border: "1.5px solid #E8721C", background: "white", color: "#E8721C", fontWeight: 800, cursor: "pointer" }}>−</button>
                      <span style={{ fontWeight: 700, fontSize: 14, minWidth: 16, textAlign: "center" }}>{qty}</span>
                      <button onClick={() => addItem(item)} style={{ width: 26, height: 26, borderRadius: 6, background: "#E8721C", border: "none", color: "white", fontWeight: 800, cursor: "pointer" }}>+</button>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 14, minWidth: 52, textAlign: "right" }}>₹{(item.price * qty).toFixed(0)}</span>
                  </div>
                </div>
              ))}

              {/* Total */}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", fontWeight: 800, fontSize: 16, borderTop: "2px solid #0F1623", marginTop: 4 }}>
                <span>Total</span><span style={{ color: "#E8721C" }}>₹{totalPrice.toFixed(0)}</span>
              </div>

              {/* Customer form */}
              <div style={{ marginTop: 8 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 10px" }}>Your Details</h3>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name *"
                  style={{ width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 10, padding: "11px 14px", fontSize: 14, outline: "none", marginBottom: 10, fontFamily: "inherit" }} />
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone number *" type="tel" required
                  style={{ width: "100%", border: `1.5px solid ${form.phone && form.phone.length < 10 ? "#DC2626" : "#E2E8F0"}`, borderRadius: 10, padding: "11px 14px", fontSize: 14, outline: "none", marginBottom: 10, fontFamily: "inherit" }} />
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Order notes (optional)…" rows={2}
                  style={{ width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 10, padding: "11px 14px", fontSize: 14, outline: "none", resize: "none", fontFamily: "inherit", marginBottom: 16 }} />
                <button onClick={placeOrder} disabled={submitting}
                  style={{ width: "100%", background: submitting ? "#94A3B8" : "#E8721C", color: "white", border: "none", borderRadius: 12, padding: 15, fontWeight: 800, fontSize: 16, cursor: submitting ? "not-allowed" : "pointer" }}>
                  {submitting ? "Placing Order…" : `🍽️ Place Order · ₹${totalPrice.toFixed(0)}`}
                </button>
                <p style={{ textAlign: "center", fontSize: 12, color: "#94A3B8", marginTop: 10 }}>A waiter will confirm your order shortly.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MenuPage() {
  return (
    <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>Loading…</div>}>
      <MenuContent />
    </Suspense>
  );
}
