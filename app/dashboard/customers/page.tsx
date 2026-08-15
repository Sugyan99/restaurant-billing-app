"use client";
import { DeleteButton } from "@/components/DeleteButton";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useState, useEffect, useCallback } from "react";
import { PageTabs } from "@/components/PageTabs";
import LoyaltyPage from "@/app/dashboard/loyalty/page";
import { showToast } from "@/components/Toast";

/* ── Types ─────────────────────────────────────────────────── */
type Customer = {
  id: string; name: string; phone: string; email?: string;
  address?: string; totalVisits: number; totalSpent: number;
  loyaltyPoints: number; creditBalance: number; birthday?: string;
  gender?: string; notes?: string; createdAt: string;
};
type OrderItem = { menuItem: { name: string }; quantity: number };
type Order = {
  id: string; orderNumber: number; type: string; status: string; createdAt: string;
  bill?: { total: number; paymentMode: string; paymentStatus: string };
  items: OrderItem[];
};
type Feedback = {
  id: string; rating: number; comment?: string; category: string;
  customerName?: string; customerPhone?: string; createdAt: string;
  customer?: { name: string; phone: string };
};
type Coupon = {
  id: string; code: string; description?: string; type: string; value: number;
  minOrder: number; usageLimit: number; usedCount: number; expiresAt?: string;
  isActive: boolean; createdAt: string; _count?: { usages: number };
};
type Analytics = {
  totalCustomers: number; newThisMonth: number;
  segments: { vip: number; silver: number; bronze: number; new: number };
  monthly: { month: string; count: number }[];
  topCustomers: { id: string; name: string; phone: string; totalSpent: number; totalVisits: number; loyaltyPoints: number }[];
  avgStats: { _avg: { totalSpent: number | null; totalVisits: number | null }; _sum: { totalSpent: number | null } };
  feedbackStats: { _avg: { rating: number | null }; _count: { id: number } };
};
type BdCustomer = { id: string; name: string; phone: string; birthday: string; loyaltyPoints: number };

/* ── Helpers ────────────────────────────────────────────────── */
const tier = (pts: number) =>
  pts >= 5000 ? { name: "Gold",   icon: "🥇", color: "#F59E0B", bg: "#FEF3C7" } :
  pts >= 1000 ? { name: "Silver", icon: "🥈", color: "#64748B", bg: "#F1F5F9" } :
               { name: "Bronze", icon: "🥉", color: "#92400E", bg: "#FEF3C7" };

const wa = (phone: string, msg: string) =>
  `https://wa.me/91${phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;

const stars = (n: number) => Array.from({ length: 5 }, (_, i) => i < n ? "★" : "☆").join("");

const favoriteItemsFrom = (orders: Order[]) => {
  const map: Record<string, number> = {};
  orders.forEach(o => o.items.forEach(i => {
    const k = i.menuItem.name;
    map[k] = (map[k] || 0) + i.quantity;
  }));
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
};

const CAT_COLOR: Record<string, string> = {
  FOOD: "#E8721C", SERVICE: "#3B82F6", AMBIENCE: "#10B981", VALUE: "#8B5CF6", OVERALL: "#F59E0B",
};

/* ── Root ───────────────────────────────────────────────────── */
export default function CustomersPage() {
  return (
    <PageTabs tabs={[
      { id: "customers",  label: "Customers",  icon: "👤" },
      { id: "loyalty",    label: "Loyalty",    icon: "⭐" },
      { id: "birthdays",  label: "Birthdays",  icon: "🎂" },
      { id: "analytics",  label: "Analytics",  icon: "📊" },
      { id: "feedback",   label: "Feedback",   icon: "💬" },
      { id: "coupons",    label: "Coupons",    icon: "🎟️" },
    ]}>
      {tab =>
        tab === "loyalty"   ? <LoyaltyPage />    :
        tab === "birthdays" ? <BirthdaysTab />   :
        tab === "analytics" ? <AnalyticsTab />   :
        tab === "feedback"  ? <FeedbackTab />    :
        tab === "coupons"   ? <CouponsTab />     :
        <CustomersTab />
      }
    </PageTabs>
  );
}

/* ══════════════════════════════════════════════════════════════
   CUSTOMERS TAB  ── list + birthday banner + profile drawer
══════════════════════════════════════════════════════════════ */
const EMPTY = { name: "", phone: "", email: "", address: "", birthday: "", gender: "" };

function CustomersTab() {
  const { isOwner, isManager } = useCurrentUser();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch]       = useState("");
  const [showAdd, setShowAdd]     = useState(false);
  const [form, setForm]           = useState(EMPTY);
  const [loading, setLoading]     = useState(false);
  const [selected, setSelected]   = useState<string | null>(null);
  const [birthdays, setBirthdays] = useState<BdCustomer[]>([]);

  const load = useCallback(async () => {
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await fetch(`/api/customers${q}`);
    const d = await res.json();
    setCustomers(d.customers ?? []);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  // Load upcoming birthdays (this month)
  useEffect(() => {
    const m = String(new Date().getMonth() + 1).padStart(2, "0");
    fetch(`/api/crm?type=birthdays&month=${m}`)
      .then(r => r.json())
      .then(d => {
        const today = new Date().getDate();
        const upcoming = (d.customers ?? []).filter((c: BdCustomer) => {
          const parts = c.birthday.split("-");
          const day = parseInt(parts[parts.length - 1]);
          return day >= today && day <= today + 14;
        });
        setBirthdays(upcoming);
      });
  }, []);

  async function save() {
    if (!form.name.trim()) { showToast("Name required", "error"); return; }
    if (form.phone.length < 10) { showToast("Valid phone required", "error"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showToast(d.message ?? "Customer added!");
      setShowAdd(false); setForm(EMPTY);
      await load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed", "error");
    } finally { setLoading(false); }
  }

  return (
    <div>
      {/* ── Birthday Banner ── */}
      {birthdays.length > 0 && (
        <div style={{ background: "linear-gradient(135deg,#FEF3C7,#FFFBEB)", border: "1px solid #FDE68A", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 22 }}>🎂</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "#92400E", fontSize: 13 }}>Upcoming Birthdays</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
              {birthdays.map(c => (
                <a key={c.id} href={wa(c.phone, `🎂 Happy Birthday ${c.name}! 🎉 Wishing you a wonderful day. As our valued customer, enjoy a special birthday discount on your next visit. Come celebrate with us! 🍽️`)}
                  target="_blank" rel="noreferrer"
                  style={{ background: "#F59E0B", color: "#fff", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                  🎁 {c.name}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Customers</h2>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B" }}>{customers.length} customers</p>
        </div>
        {isManager && <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Customer</button>}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: "10px 14px" }}>
          <input className="form-input" placeholder="🔍 Search by name or phone…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {customers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
          <div style={{ fontSize: 40 }}>👤</div>
          <p style={{ fontWeight: 600 }}>{search ? "No customers found" : "No customers yet"}</p>
        </div>
      ) : (
        <div className="card">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                  {["Customer", "Phone", "Tier", "Visits", "Spent", "Since", ""].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map(c => {
                  const t = tier(c.loyaltyPoints);
                  return (
                    <tr key={c.id} onClick={() => setSelected(c.id)}
                      style={{ borderBottom: "1px solid #F1F5F9", cursor: "pointer", transition: "background .1s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: "50%", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: t.color, fontSize: 13, flexShrink: 0 }}>
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{c.name}</div>
                            {c.birthday && <div style={{ fontSize: 10, color: "#94A3B8" }}>🎂 {c.birthday}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px" }}>{c.phone}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ background: t.bg, color: t.color, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{t.icon} {t.name}</span>
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700 }}>{c.totalVisits}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: "#E8721C" }}>₹{c.totalSpent.toFixed(0)}</td>
                      <td style={{ padding: "10px 14px", color: "#94A3B8", fontSize: 12 }}>{new Date(c.createdAt).toLocaleDateString("en-IN")}</td>
                      <td style={{ padding: "10px 14px" }} onClick={e => e.stopPropagation()}>
                        {isOwner && <DeleteButton url={`/api/customers/${c.id}`} onDeleted={load} confirmMsg="Delete customer?" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Add Modal ── */}
      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal">
            <h3 className="modal-title">Add Customer</h3>
            {[
              { label: "Name *", key: "name", placeholder: "Customer name" },
              { label: "Phone *", key: "phone", placeholder: "10-digit mobile" },
              { label: "Email",   key: "email", placeholder: "Optional" },
              { label: "Address", key: "address", placeholder: "Optional" },
            ].map(f => (
              <div className="form-group" key={f.key}>
                <label className="form-label">{f.label}</label>
                <input className="form-input" placeholder={f.placeholder}
                  value={(form as Record<string, string>)[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
              </div>
            ))}
            <div className="form-group">
              <label className="form-label">Birthday</label>
              <input className="form-input" type="date"
                value={form.birthday} onChange={e => setForm({ ...form, birthday: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select className="form-input" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={loading}>{loading ? "Saving…" : "Add Customer"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Profile Drawer ── */}
      {selected && <CustomerDrawer customerId={selected} onClose={() => setSelected(null)} onSaved={load} />}
    </div>
  );
}

/* ── Customer Profile Drawer ───────────────────────────────── */
function CustomerDrawer({ customerId, onClose, onSaved }: { customerId: string; onClose: () => void; onSaved: () => void }) {
  const { isManager } = useCurrentUser();
  const [data, setData]     = useState<{ customer: Customer; orders: Order[] } | null>(null);
  const [drawerTab, setDrawerTab] = useState<"profile" | "orders" | "favorites">("profile");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Customer>>({});
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    fetch(`/api/customers/${customerId}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        setEditForm({
          name: d.customer.name, email: d.customer.email ?? "",
          address: d.customer.address ?? "", birthday: d.customer.birthday ?? "",
          gender: d.customer.gender ?? "", notes: d.customer.notes ?? "",
          creditBalance: d.customer.creditBalance,
        });
      });
  }, [customerId]);

  async function saveEdit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setData(prev => prev ? { ...prev, customer: d.customer } : prev);
      setEditing(false);
      showToast("Profile updated!");
      onSaved();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed", "error");
    } finally { setSaving(false); }
  }

  if (!data) return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }}>
      <div style={{ width: "min(480px,100vw)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#94A3B8" }}>Loading…</span>
      </div>
    </div>
  );

  const c = data.customer;
  const t = tier(c.loyaltyPoints);
  const favs = favoriteItemsFrom(data.orders);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 1000 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "min(500px,100vw)", background: "#fff", display: "flex", flexDirection: "column", boxShadow: "-4px 0 30px rgba(0,0,0,.15)" }}>

        {/* Header */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #F1F5F9", background: "linear-gradient(135deg,#FFF7ED,#FFF)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: t.color, fontSize: 20 }}>
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17 }}>{c.name}</div>
                <div style={{ fontSize: 13, color: "#64748B" }}>{c.phone}</div>
                <span style={{ background: t.bg, color: t.color, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700, display: "inline-block", marginTop: 4 }}>{t.icon} {t.name} · {c.loyaltyPoints} pts</span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94A3B8", padding: 4 }}>✕</button>
          </div>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 16 }}>
            {[
              { label: "Visits",   value: c.totalVisits },
              { label: "Spent",    value: `₹${c.totalSpent.toFixed(0)}` },
              { label: "Points",   value: c.loyaltyPoints },
              { label: "Credit",   value: `₹${c.creditBalance.toFixed(0)}` },
            ].map(s => (
              <div key={s.label} style={{ background: "#F8FAFC", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#1E293B" }}>{s.value}</div>
                <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* WhatsApp button */}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <a href={wa(c.phone, `Hi ${c.name}! 👋 Thank you for visiting us. We appreciate your loyalty. ₹${c.totalSpent.toFixed(0)} spent | ${c.loyaltyPoints} points earned! Visit us again soon. 🍽️`)}
              target="_blank" rel="noreferrer"
              style={{ flex: 1, background: "#25D366", color: "#fff", borderRadius: 8, padding: "8px 0", textAlign: "center", fontWeight: 700, fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              💬 WhatsApp
            </a>
            {isManager && (
              <button onClick={() => setEditing(!editing)}
                style={{ flex: 1, background: editing ? "#EFF6FF" : "#F1F5F9", color: editing ? "#3B82F6" : "#475569", border: "none", borderRadius: 8, padding: "8px 0", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                ✏️ {editing ? "Cancel Edit" : "Edit Profile"}
              </button>
            )}
          </div>
        </div>

        {/* Drawer Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #F1F5F9" }}>
          {(["profile", "orders", "favorites"] as const).map(dt => (
            <button key={dt} onClick={() => setDrawerTab(dt)}
              style={{ flex: 1, padding: "10px 0", border: "none", background: "none", cursor: "pointer", fontSize: 12, fontWeight: drawerTab === dt ? 700 : 500, color: drawerTab === dt ? "#E8721C" : "#64748B", borderBottom: drawerTab === dt ? "2px solid #E8721C" : "2px solid transparent", textTransform: "capitalize" }}>
              {dt === "profile" ? "👤 Profile" : dt === "orders" ? `📋 Orders (${data.orders.length})` : `❤️ Favorites`}
            </button>
          ))}
        </div>

        {/* Drawer Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {drawerTab === "profile" && (
            <div>
              {editing ? (
                <div>
                  {[
                    { label: "Name", key: "name" }, { label: "Email", key: "email" },
                    { label: "Address", key: "address" }, { label: "Notes", key: "notes" },
                  ].map(f => (
                    <div className="form-group" key={f.key}>
                      <label className="form-label">{f.label}</label>
                      <input className="form-input" value={(editForm as Record<string, string | number | undefined>)[f.key] as string ?? ""}
                        onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })} />
                    </div>
                  ))}
                  <div className="form-group">
                    <label className="form-label">Birthday</label>
                    <input className="form-input" type="date" value={editForm.birthday ?? ""}
                      onChange={e => setEditForm({ ...editForm, birthday: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gender</label>
                    <select className="form-input" value={editForm.gender ?? ""} onChange={e => setEditForm({ ...editForm, gender: e.target.value })}>
                      <option value="">Select</option>
                      <option>Male</option><option>Female</option><option>Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Credit Balance (₹)</label>
                    <input className="form-input" type="number" value={editForm.creditBalance ?? 0}
                      onChange={e => setEditForm({ ...editForm, creditBalance: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <button className="btn btn-primary" style={{ width: "100%" }} onClick={saveEdit} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Membership Card */}
                  <div style={{ background: `linear-gradient(135deg, ${t.bg}, ${t.color}22)`, border: `1.5px solid ${t.color}44`, borderRadius: 14, padding: "14px 16px", marginBottom: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: t.color, letterSpacing: 1 }}>Membership</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: t.color }}>{t.icon} {t.name}</div>
                        <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Member since {new Date(c.createdAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>Points</div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: t.color }}>{c.loyaltyPoints}</div>
                        <div style={{ fontSize: 10, color: "#64748B" }}>
                          {t.name === "Gold" ? "Top tier 🏆" : t.name === "Silver" ? `${5000 - c.loyaltyPoints} pts to Gold` : `${1000 - c.loyaltyPoints} pts to Silver`}
                        </div>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div style={{ marginTop: 10 }}>
                      <div style={{ height: 5, background: "#E2E8F0", borderRadius: 3 }}>
                        <div style={{ height: "100%", borderRadius: 3, background: t.color, width: `${Math.min(100, t.name === "Gold" ? 100 : t.name === "Silver" ? ((c.loyaltyPoints - 1000) / 4000) * 100 : (c.loyaltyPoints / 1000) * 100)}%`, transition: "width .3s" }} />
                      </div>
                    </div>
                    {/* Benefits */}
                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {(t.name === "Gold" ? ["Priority seating", "5% discount", "Birthday treat", "Free dessert"] :
                        t.name === "Silver" ? ["2% discount", "Birthday offer"] :
                        ["Earn 1pt per ₹10"]).map(b => (
                        <span key={b} style={{ fontSize: 10, background: t.color + "22", color: t.color, borderRadius: 20, padding: "2px 8px", fontWeight: 700 }}>{b}</span>
                      ))}
                    </div>
                  </div>

                  {[
                    { icon: "📧", label: "Email",    value: c.email || "—" },
                    { icon: "📍", label: "Address",  value: c.address || "—" },
                    { icon: "🎂", label: "Birthday", value: c.birthday || "—" },
                    { icon: "👤", label: "Gender",   value: c.gender || "—" },
                    { icon: "💳", label: "Credit Balance", value: `₹${c.creditBalance.toFixed(2)}` },
                    { icon: "📝", label: "Notes",    value: c.notes || "—" },
                  ].map(row => (
                    <div key={row.label} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>{row.icon}</span>
                      <div>
                        <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>{row.label}</div>
                        <div style={{ fontSize: 14, color: "#1E293B" }}>{row.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {drawerTab === "orders" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.orders.length === 0 ? (
                <p style={{ color: "#94A3B8", textAlign: "center", padding: "30px 0" }}>No orders yet</p>
              ) : data.orders.map(o => (
                <div key={o.id} style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 14px", border: "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>#{o.orderNumber} · {o.type}</span>
                    <span style={{ fontWeight: 700, color: "#E8721C" }}>{o.bill ? `₹${o.bill.total.toFixed(0)}` : "—"}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748B", marginBottom: 6 }}>
                    {o.items.map(i => `${i.menuItem.name} ×${i.quantity}`).join(", ")}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94A3B8" }}>
                    <span>{new Date(o.createdAt).toLocaleDateString("en-IN")}</span>
                    {o.bill && <span>{o.bill.paymentMode}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {drawerTab === "favorites" && (
            <div>
              {favs.length === 0 ? (
                <p style={{ color: "#94A3B8", textAlign: "center", padding: "30px 0" }}>No order data</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ fontSize: 12, color: "#64748B", marginBottom: 8 }}>Most ordered items by this customer</p>
                  {favs.map((f, i) => (
                    <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 12, background: "#F8FAFC", borderRadius: 8, padding: "10px 14px" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: i === 0 ? "#FEF3C7" : "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: i === 0 ? "#F59E0B" : "#64748B", fontSize: 13 }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{f.name}</div>
                      <div style={{ background: "#E8721C", color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>×{f.count}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ANALYTICS TAB
══════════════════════════════════════════════════════════════ */
function AnalyticsTab() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    fetch("/api/crm?type=analytics").then(r => r.json()).then(setData);
  }, []);

  if (!data) return <div style={{ padding: "60px 0", textAlign: "center", color: "#94A3B8" }}>Loading analytics…</div>;

  const maxMonthly = Math.max(...data.monthly.map(m => m.count), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
        {[
          { label: "Total Customers", value: data.totalCustomers, icon: "👥", color: "#3B82F6" },
          { label: "New This Month",  value: data.newThisMonth,   icon: "🆕", color: "#10B981" },
          { label: "Total Revenue",   value: `₹${(data.avgStats._sum.totalSpent ?? 0).toFixed(0)}`, icon: "💰", color: "#E8721C" },
          { label: "Avg Rating",      value: data.feedbackStats._avg.rating ? `${data.feedbackStats._avg.rating.toFixed(1)} ⭐` : "—", icon: "⭐", color: "#F59E0B" },
        ].map(k => (
          <div key={k.label} className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
            <div style={{ fontSize: 28 }}>{k.icon}</div>
            <div style={{ fontWeight: 800, fontSize: 22, color: k.color, marginTop: 4 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Loyalty Segments */}
        <div className="card">
          <div className="card-body">
            <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>🏅 Loyalty Segments</div>
            {[
              { label: "Gold Members",   value: data.segments.vip,    color: "#F59E0B", icon: "🥇" },
              { label: "Silver Members", value: data.segments.silver, color: "#64748B", icon: "🥈" },
              { label: "Bronze Members", value: data.segments.bronze, color: "#92400E", icon: "🥉" },
              { label: "New (0 pts)",    value: data.segments.new,    color: "#94A3B8", icon: "🆕" },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ width: 26, textAlign: "center" }}>{s.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{s.value}</span>
                  </div>
                  <div style={{ height: 5, background: "#F1F5F9", borderRadius: 3 }}>
                    <div style={{ height: "100%", background: s.color, borderRadius: 3, width: `${data.totalCustomers ? (s.value / data.totalCustomers) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Growth */}
        <div className="card">
          <div className="card-body">
            <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>📈 New Customers (6 mo)</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>
              {data.monthly.map(m => (
                <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#1E293B" }}>{m.count}</div>
                  <div style={{ width: "100%", background: "#E8721C", borderRadius: "3px 3px 0 0", height: `${(m.count / maxMonthly) * 100}px`, minHeight: m.count > 0 ? 4 : 0, transition: "height .3s" }} />
                  <div style={{ fontSize: 9, color: "#94A3B8", textAlign: "center" }}>{m.month.slice(5)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Customers */}
      <div className="card">
        <div className="card-body">
          <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>🏆 Top Customers by Spend</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.topCustomers.slice(0, 8).map((c, i) => {
              const t = tier(c.loyaltyPoints);
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #F1F5F9" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: i < 3 ? "#FEF3C7" : "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, color: i < 3 ? "#F59E0B" : "#64748B" }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>{c.phone} · {c.totalVisits} visits</div>
                  </div>
                  <span style={{ fontSize: 11, background: t.bg, color: t.color, borderRadius: 20, padding: "1px 8px", fontWeight: 700 }}>{t.icon}</span>
                  <div style={{ fontWeight: 800, color: "#E8721C", fontSize: 14 }}>₹{c.totalSpent.toFixed(0)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   FEEDBACK TAB
══════════════════════════════════════════════════════════════ */
function FeedbackTab() {
  const { isManager } = useCurrentUser();
  const [feedback, setFeedback]   = useState<Feedback[]>([]);
  const [stats, setStats]         = useState<{ _avg: { rating: number | null }; _count: { id: number } } | null>(null);
  const [dist, setDist]           = useState<{ rating: number; _count: { id: number } }[]>([]);
  const [catFilter, setCatFilter] = useState("");
  const [showAdd, setShowAdd]     = useState(false);
  const [form, setForm]           = useState({ customerPhone: "", customerName: "", rating: 5, comment: "", category: "OVERALL" });
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    const q = catFilter ? `?category=${catFilter}` : "";
    const res = await fetch(`/api/feedback${q}`);
    const d = await res.json();
    setFeedback(d.feedback ?? []);
    setStats(d.stats);
    setDist(d.distribution ?? []);
  }, [catFilter]);

  useEffect(() => { load(); }, [load]);

  async function addFeedback() {
    setSaving(true);
    try {
      const res = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showToast("Feedback added!");
      setShowAdd(false);
      setForm({ customerPhone: "", customerName: "", rating: 5, comment: "", category: "OVERALL" });
      load();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setSaving(false); }
  }

  const avgRating = stats?._avg.rating ?? 0;

  return (
    <div>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ textAlign: "center", padding: "14px 10px" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#F59E0B" }}>{avgRating ? avgRating.toFixed(1) : "—"}</div>
          <div style={{ fontSize: 22, color: "#F59E0B" }}>{avgRating ? stars(Math.round(avgRating)) : "☆☆☆☆☆"}</div>
          <div style={{ fontSize: 11, color: "#94A3B8", textTransform: "uppercase", fontWeight: 700 }}>Avg Rating</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "14px 10px" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#3B82F6" }}>{stats?._count.id ?? 0}</div>
          <div style={{ fontSize: 11, color: "#94A3B8", textTransform: "uppercase", fontWeight: 700 }}>Total Reviews</div>
        </div>
        {dist.slice(0, 3).map(d => (
          <div key={d.rating} className="card" style={{ textAlign: "center", padding: "14px 10px" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: d.rating >= 4 ? "#10B981" : d.rating >= 3 ? "#F59E0B" : "#EF4444" }}>{d._count.id}</div>
            <div style={{ fontSize: 13 }}>{"★".repeat(d.rating)}</div>
            <div style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", fontWeight: 700 }}>{d.rating}-star</div>
          </div>
        ))}
      </div>

      {/* Filters & Actions */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {["", "FOOD", "SERVICE", "AMBIENCE", "VALUE", "OVERALL"].map(cat => (
          <button key={cat} onClick={() => setCatFilter(cat)}
            style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${catFilter === cat ? "#E8721C" : "#E2E8F0"}`, background: catFilter === cat ? "#E8721C" : "#fff", color: catFilter === cat ? "#fff" : "#64748B", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
            {cat || "All"} {cat && <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: CAT_COLOR[cat] ?? "#ccc", marginLeft: 4 }} />}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {isManager && <button className="btn btn-primary" style={{ padding: "6px 14px", fontSize: 12 }} onClick={() => setShowAdd(true)}>+ Add Feedback</button>}
      </div>

      {/* Feedback List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {feedback.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
            <div style={{ fontSize: 40 }}>💬</div><p>No feedback yet</p>
          </div>
        ) : feedback.map(f => (
          <div key={f.id} className="card" style={{ padding: 0 }}>
            <div className="card-body" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{f.customer?.name ?? f.customerName ?? "Anonymous"}</span>
                  {f.customerPhone && <span style={{ fontSize: 12, color: "#94A3B8", marginLeft: 8 }}>{f.customerPhone}</span>}
                </div>
                <span style={{ background: CAT_COLOR[f.category] ?? "#94A3B8", color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{f.category}</span>
              </div>
              <div style={{ color: "#F59E0B", fontSize: 16, marginBottom: 6 }}>{stars(f.rating)}</div>
              {f.comment && <p style={{ margin: 0, fontSize: 13, color: "#475569", lineHeight: 1.5 }}>{f.comment}</p>}
              <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 8 }}>{new Date(f.createdAt).toLocaleDateString("en-IN")}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Feedback Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal">
            <h3 className="modal-title">Add Feedback</h3>
            <div className="form-group">
              <label className="form-label">Customer Phone</label>
              <input className="form-input" placeholder="Optional" value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Customer Name</label>
              <input className="form-input" placeholder="Optional" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Rating *</label>
              <div style={{ display: "flex", gap: 6 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setForm({ ...form, rating: n })}
                    style={{ width: 36, height: 36, borderRadius: 8, border: `2px solid ${form.rating >= n ? "#F59E0B" : "#E2E8F0"}`, background: form.rating >= n ? "#FEF3C7" : "#fff", cursor: "pointer", fontSize: 18 }}>
                    ★
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {["OVERALL", "FOOD", "SERVICE", "AMBIENCE", "VALUE"].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Comment</label>
              <textarea className="form-input" rows={3} placeholder="Optional" value={form.comment}
                onChange={e => setForm({ ...form, comment: e.target.value })} style={{ resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addFeedback} disabled={saving}>{saving ? "Saving…" : "Submit"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   COUPONS TAB
══════════════════════════════════════════════════════════════ */
const COUPON_EMPTY = { code: "", description: "", type: "PERCENT", value: "", minOrder: "", usageLimit: "", expiresAt: "" };

function CouponsTab() {
  const { isManager } = useCurrentUser();
  const [coupons, setCoupons]   = useState<Coupon[]>([]);
  const [showAdd, setShowAdd]   = useState(false);
  const [form, setForm]         = useState(COUPON_EMPTY);
  const [saving, setSaving]     = useState(false);
  const [validateCode, setValidateCode] = useState("");
  const [validateResult, setValidateResult] = useState<{ ok: boolean; msg: string; coupon?: Coupon } | null>(null);

  async function checkCoupon() {
    if (!validateCode.trim()) return;
    const res = await fetch(`/api/coupons?code=${encodeURIComponent(validateCode.trim().toUpperCase())}`);
    const d = await res.json();
    if (res.ok) {
      const c = d.coupon as Coupon;
      setValidateResult({ ok: true, msg: `✅ Valid — ${c.type === "PERCENT" ? `${c.value}% off` : `₹${c.value} off`}${c.minOrder ? ` on min ₹${c.minOrder}` : ""}`, coupon: c });
    } else {
      setValidateResult({ ok: false, msg: `❌ ${d.error}` });
    }
  }

  const load = useCallback(async () => {
    const res = await fetch("/api/coupons");
    const d = await res.json();
    setCoupons(d.coupons ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveCoupon() {
    setSaving(true);
    try {
      const res = await fetch("/api/coupons", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code, description: form.description, type: form.type,
          value: parseFloat(form.value), minOrder: parseFloat(form.minOrder) || 0,
          usageLimit: parseInt(form.usageLimit) || 0,
          expiresAt: form.expiresAt || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showToast("Coupon created!");
      setShowAdd(false); setForm(COUPON_EMPTY);
      load();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setSaving(false); }
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/coupons/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !isActive }) });
    load();
  }

  const active = coupons.filter(c => c.isActive).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Coupons</h2>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B" }}>{active} active of {coupons.length}</p>
        </div>
        {isManager && <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Create Coupon</button>}
      </div>

      {/* Validate Coupon */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: "12px 16px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>🔍 Validate Coupon Code</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="form-input" placeholder="Enter code e.g. SAVE20" style={{ maxWidth: 220, fontFamily: "monospace", fontWeight: 700, letterSpacing: 1 }}
              value={validateCode}
              onChange={e => { setValidateCode(e.target.value.toUpperCase()); setValidateResult(null); }}
              onKeyDown={e => e.key === "Enter" && checkCoupon()} />
            <button className="btn btn-primary" style={{ padding: "0 16px" }} onClick={checkCoupon}>Check</button>
          </div>
          {validateResult && (
            <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: validateResult.ok ? "#F0FDF4" : "#FEF2F2",
              color: validateResult.ok ? "#16A34A" : "#DC2626" }}>
              {validateResult.msg}
            </div>
          )}
        </div>
      </div>

      {coupons.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
          <div style={{ fontSize: 40 }}>🎟️</div><p>No coupons yet</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
          {coupons.map(c => {
            const expired = c.expiresAt ? new Date(c.expiresAt) < new Date() : false;
            const limitHit = c.usageLimit > 0 && c.usedCount >= c.usageLimit;
            const statusOk = c.isActive && !expired && !limitHit;
            return (
              <div key={c.id} style={{ background: statusOk ? "linear-gradient(135deg,#FFF7ED,#FFF)" : "#F8FAFC", border: `1px solid ${statusOk ? "#FDE68A" : "#E2E8F0"}`, borderRadius: 14, padding: "16px 18px", position: "relative", opacity: statusOk ? 1 : 0.7 }}>
                <div style={{ position: "absolute", top: 12, right: 14, display: "flex", gap: 6, alignItems: "center" }}>
                  {expired && <span style={{ fontSize: 10, background: "#FEE2E2", color: "#EF4444", borderRadius: 20, padding: "2px 8px", fontWeight: 700 }}>EXPIRED</span>}
                  {limitHit && <span style={{ fontSize: 10, background: "#FEE2E2", color: "#EF4444", borderRadius: 20, padding: "2px 8px", fontWeight: 700 }}>USED UP</span>}
                  {isManager && !expired && (
                    <button onClick={() => toggleActive(c.id, c.isActive)}
                      style={{ fontSize: 10, background: c.isActive ? "#DCFCE7" : "#F1F5F9", color: c.isActive ? "#16A34A" : "#94A3B8", borderRadius: 20, padding: "2px 8px", fontWeight: 700, border: "none", cursor: "pointer" }}>
                      {c.isActive ? "Active" : "Inactive"}
                    </button>
                  )}
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 800, color: "#E8721C", letterSpacing: 2, marginBottom: 6 }}>{c.code}</div>
                <div style={{ fontWeight: 700, fontSize: 22, color: "#1E293B", marginBottom: 4 }}>
                  {c.type === "PERCENT" ? `${c.value}% OFF` : `₹${c.value} OFF`}
                </div>
                {c.description && <div style={{ fontSize: 12, color: "#64748B", marginBottom: 8 }}>{c.description}</div>}
                <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#94A3B8" }}>
                  {c.minOrder > 0 && <span>Min ₹{c.minOrder}</span>}
                  <span>{c.usedCount}{c.usageLimit > 0 ? `/${c.usageLimit}` : ""} used</span>
                  {c.expiresAt && <span>Exp {new Date(c.expiresAt).toLocaleDateString("en-IN")}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal">
            <h3 className="modal-title">Create Coupon</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group" style={{ gridColumn: "1/-1" }}>
                <label className="form-label">Coupon Code *</label>
                <input className="form-input" placeholder="e.g. WELCOME20" value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              </div>
              <div className="form-group">
                <label className="form-label">Type *</label>
                <select className="form-input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="PERCENT">Percent (%)</option>
                  <option value="FLAT">Flat (₹)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Value *</label>
                <input className="form-input" type="number" placeholder={form.type === "PERCENT" ? "e.g. 10" : "e.g. 50"}
                  value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Min Order (₹)</label>
                <input className="form-input" type="number" placeholder="0" value={form.minOrder}
                  onChange={e => setForm({ ...form, minOrder: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Usage Limit</label>
                <input className="form-input" type="number" placeholder="0 = unlimited" value={form.usageLimit}
                  onChange={e => setForm({ ...form, usageLimit: e.target.value })} />
              </div>
              <div className="form-group" style={{ gridColumn: "1/-1" }}>
                <label className="form-label">Description</label>
                <input className="form-input" placeholder="Optional" value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="form-group" style={{ gridColumn: "1/-1" }}>
                <label className="form-label">Expires At</label>
                <input className="form-input" type="date" value={form.expiresAt}
                  onChange={e => setForm({ ...form, expiresAt: e.target.value })} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveCoupon} disabled={saving}>{saving ? "Creating…" : "Create Coupon"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   BIRTHDAYS TAB  ── full management with month filter + bulk WA
══════════════════════════════════════════════════════════════ */
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function BirthdaysTab() {
  const now = new Date();
  const [month, setMonth]       = useState((now.getMonth() + 1).toString().padStart(2, "0"));
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading]   = useState(false);
  const [sent, setSent]         = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/crm?type=birthdays&month=${month}`);
    const d = await res.json();
    setCustomers(d.customers ?? []);
    setLoading(false);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  function bdMsg(c: Customer) {
    return `🎂 Happy Birthday ${c.name}!\n\nWishing you a wonderful birthday filled with joy! 🎉\n\nAs our valued ${tier(c.loyaltyPoints).name} member, enjoy a *special birthday discount* on your next visit.\n\nCome celebrate with us! We look forward to serving you. 🍽️✨`;
  }

  function openWA(c: Customer) {
    window.open(wa(c.phone, bdMsg(c)), "_blank");
    setSent(prev => new Set([...prev, c.id]));
  }

  function sendAll() {
    if (customers.length === 0) return;
    customers.forEach(c => window.open(wa(c.phone, bdMsg(c)), "_blank"));
    setSent(new Set(customers.map(c => c.id)));
    showToast(`Opened WhatsApp for ${customers.length} customer(s)!`);
  }

  const t = tier;
  const upcoming = customers.filter(c => {
    if (!c.birthday) return false;
    const parts = c.birthday.split("-");
    const day = parts.length === 3 ? parseInt(parts[2]) : 0;
    return day >= now.getDate() && parseInt(month) === now.getMonth() + 1;
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>🎂 Birthday Management</h2>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B" }}>
            {customers.length} birthday{customers.length !== 1 ? "s" : ""} in {MONTHS[parseInt(month) - 1]}
            {upcoming.length > 0 && ` · ${upcoming.length} upcoming`}
          </p>
        </div>
        <button className="btn btn-primary"
          style={{ background: "#25D366", borderColor: "#25D366" }}
          onClick={sendAll}
          disabled={customers.length === 0}>
          📱 Send All Wishes
        </button>
      </div>

      {/* Month Selector */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: "12px 16px" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {MONTHS.map((m, i) => {
              const val = (i + 1).toString().padStart(2, "0");
              const isNow = i === now.getMonth();
              return (
                <button key={m} onClick={() => setMonth(val)}
                  style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${month === val ? "#E8721C" : "#E2E8F0"}`,
                    background: month === val ? "#E8721C" : isNow ? "#FFF7ED" : "#fff",
                    color: month === val ? "#fff" : isNow ? "#E8721C" : "#64748B",
                    fontWeight: month === val ? 700 : 500, fontSize: 12, cursor: "pointer" }}>
                  {m.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#94A3B8" }}>Loading…</div>
      ) : customers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎂</div>
          <p style={{ fontWeight: 700, fontSize: 15, margin: "0 0 6px" }}>No birthdays in {MONTHS[parseInt(month) - 1]}</p>
          <p style={{ fontSize: 13 }}>Add birthday info to customer profiles to see them here.</p>
        </div>
      ) : (
        <div className="card">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                {["Customer", "Phone", "Birthday", "Tier", "Visits", "Total Spent", "Action"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers
                .sort((a, b) => {
                  const dayA = parseInt((a.birthday ?? "").split("-").pop() ?? "0");
                  const dayB = parseInt((b.birthday ?? "").split("-").pop() ?? "0");
                  return dayA - dayB;
                })
                .map(c => {
                  const ti = t(c.loyaltyPoints);
                  const isUpcoming = upcoming.some(u => u.id === c.id);
                  const wasSent = sent.has(c.id);
                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid #F1F5F9", background: isUpcoming ? "#FFFBEB" : "transparent" }}>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: ti.bg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: ti.color, fontSize: 13 }}>
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{c.name}</div>
                            {isUpcoming && <div style={{ fontSize: 10, color: "#D97706", fontWeight: 700 }}>🎉 Upcoming</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px", color: "#64748B" }}>{c.phone}</td>
                      <td style={{ padding: "12px 14px", fontWeight: 600 }}>🎂 {c.birthday}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ fontSize: 11, background: ti.bg, color: ti.color, borderRadius: 20, padding: "2px 8px", fontWeight: 700 }}>
                          {ti.icon} {ti.name}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 700 }}>{c.totalVisits}</td>
                      <td style={{ padding: "12px 14px", fontWeight: 700, color: "#E8721C" }}>₹{c.totalSpent.toFixed(0)}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <button onClick={() => openWA(c)}
                          style={{ padding: "6px 14px", background: wasSent ? "#DCFCE7" : "#25D366", color: wasSent ? "#16A34A" : "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                          {wasSent ? "✅ Sent" : "🎉 Send Wish"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
