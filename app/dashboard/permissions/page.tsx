"use client";
import { useState, useEffect } from "react";
import { showToast } from "@/components/Toast";

type Perms = Record<string, string[]>;

const PAGES = [
  { id: "home",            label: "Dashboard",          icon: "🏠", cat: "Operations",  desc: "Home stats overview" },
  { id: "tables",          label: "Tables & POS",        icon: "🪑", cat: "Operations",  desc: "Table management, order entry" },
  { id: "orders",          label: "Smart KOT",           icon: "🍳", cat: "Operations",  desc: "Kitchen order tickets" },
  { id: "delivery",        label: "Delivery & Takeaway", icon: "🛵", cat: "Operations",  desc: "Delivery and takeaway tracking" },
  { id: "bills",           label: "Bills & Payments",    icon: "🧾", cat: "Operations",  desc: "Billing, GST, payment collection" },
  { id: "reservations",    label: "Reservations",        icon: "📅", cat: "Operations",  desc: "Table reservation management" },
  { id: "menu",            label: "Menu Management",     icon: "🍽️", cat: "Management", desc: "Add/edit/delete menu items" },
  { id: "inventory",       label: "Inventory",           icon: "📦", cat: "Management", desc: "Stock levels and alerts" },
  { id: "stock-ledger",    label: "Stock Ledger",        icon: "📒", cat: "Management", desc: "Inventory transaction history" },
  { id: "purchase-orders", label: "Purchase Orders",     icon: "🛒", cat: "Management", desc: "Supplier purchase orders" },
  { id: "customers",       label: "Customers",           icon: "👤", cat: "Management", desc: "Customer database" },
  { id: "loyalty",         label: "Loyalty Program",     icon: "⭐", cat: "Management", desc: "Points and rewards management" },
  { id: "discounts",       label: "Discounts",           icon: "🏷️", cat: "Management", desc: "Promotions and discount codes" },
  { id: "expenses",        label: "Expenses",            icon: "💰", cat: "Management", desc: "Business expense tracking" },
  { id: "day-close",       label: "Day Close",           icon: "🔒", cat: "Management", desc: "End-of-day reconciliation" },
  { id: "import",          label: "Import Menu",         icon: "⬆️", cat: "Management", desc: "CSV bulk menu import" },
  { id: "qr",              label: "Table QR Codes",      icon: "📱", cat: "Management", desc: "Generate/print QR codes" },
  { id: "reports",         label: "Sales Reports",       icon: "📊", cat: "Analytics",  desc: "Sales analytics and charts" },
  { id: "gst-report",      label: "GST Report",          icon: "🧾", cat: "Analytics",  desc: "GST filing reports" },
  { id: "staff-report",    label: "Staff Performance",   icon: "👨‍💼", cat: "Analytics",  desc: "Staff productivity metrics" },
  { id: "pnl",             label: "P&L Statement",       icon: "💹", cat: "Analytics",  desc: "Profit and loss overview" },
  { id: "users",           label: "Staff Management",    icon: "👥", cat: "Admin",      desc: "Add/edit staff accounts" },
  { id: "permissions",     label: "Permissions",         icon: "🔑", cat: "Admin",      desc: "Role-based access control" },
  { id: "settings",        label: "Settings",            icon: "⚙️", cat: "Admin",      desc: "Restaurant configuration" },
  { id: "data-management", label: "Data Management",     icon: "🗃️", cat: "Admin",      desc: "Export/backup data" },
];

const CATS = ["Operations", "Management", "Analytics", "Admin"];
const ROLES = ["MANAGER", "CASHIER", "KITCHEN"] as const;
const ROLE_META: Record<string, { color: string; icon: string; desc: string }> = {
  MANAGER: { color: "#2563EB", icon: "🏪", desc: "Branch managers, supervisors" },
  CASHIER:  { color: "#16A34A", icon: "💳", desc: "Billing staff, front desk" },
  KITCHEN:  { color: "#D97706", icon: "👨‍🍳", desc: "Kitchen staff, cooks" },
};

// Preset templates
const PRESETS: Record<string, Record<string, string[]>> = {
  "Recommended": {
    MANAGER: ["home","tables","orders","delivery","bills","menu","inventory","stock-ledger","purchase-orders","customers","loyalty","discounts","expenses","day-close","import","qr","reservations","reports","gst-report","staff-report","pnl"],
    CASHIER:  ["home","tables","orders","delivery","bills","customers","loyalty","reservations","discounts"],
    KITCHEN:  ["orders","delivery"],
  },
  "Strict": {
    MANAGER: ["home","tables","orders","delivery","bills","customers","reservations","reports"],
    CASHIER:  ["tables","orders","bills","customers"],
    KITCHEN:  ["orders"],
  },
  "Open": {
    MANAGER: PAGES.map(p => p.id),
    CASHIER:  ["home","tables","orders","delivery","bills","customers","loyalty","discounts","reservations","menu","reports"],
    KITCHEN:  ["home","orders","delivery","inventory"],
  },
};

export default function PermissionsPage() {
  const [perms, setPerms]     = useState<Perms>({});
  const [loading, setLoading] = useState(false);
  const [openCat, setOpenCat] = useState("Operations");
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    fetch("/api/permissions").then(r => r.json()).then(d => setPerms(d.permissions ?? {}));
  }, []);

  function toggle(role: string, pageId: string) {
    setChanged(true);
    setPerms(prev => {
      const current = prev[role] ?? [];
      return { ...prev, [role]: current.includes(pageId) ? current.filter(x => x !== pageId) : [...current, pageId] };
    });
  }

  function toggleAll(role: string, cat: string) {
    setChanged(true);
    const catPages = PAGES.filter(p => p.cat === cat).map(p => p.id);
    const current  = perms[role] ?? [];
    const allOn    = catPages.every(p => current.includes(p));
    setPerms(prev => ({
      ...prev,
      [role]: allOn ? current.filter(p => !catPages.includes(p)) : [...new Set([...current, ...catPages])],
    }));
  }

  function applyPreset(name: string) {
    if (!confirm(`Apply "${name}" preset? This will overwrite current permissions.`)) return;
    setPerms(prev => ({ ...prev, ...PRESETS[name], OWNER: ["*"] }));
    setChanged(true);
    showToast(`"${name}" preset applied — save to confirm`);
  }

  function copyRole(from: string, to: string) {
    setPerms(prev => ({ ...prev, [to]: [...(prev[from] ?? [])] }));
    setChanged(true);
    showToast(`Copied ${from} → ${to}`);
  }

  function hasAccess(role: string, pageId: string) {
    const r = perms[role] ?? [];
    return r.includes("*") || r.includes(pageId);
  }

  function roleCount(role: string) {
    const r = perms[role] ?? [];
    return r.includes("*") ? PAGES.length : r.length;
  }

  async function save() {
    setLoading(true);
    const res = await fetch("/api/permissions", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions: perms }),
    });
    setLoading(false);
    if (res.ok) { showToast("Permissions saved!"); setChanged(false); }
    else showToast("Failed to save", "error");
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Permission Manager</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>Control what each role can access · 👑 Owner always has full access</p>
        </div>
        <button className="btn btn-primary" onClick={save} disabled={loading || !changed}
          style={{ minWidth: 140, justifyContent: "center", opacity: changed ? 1 : 0.6 }}>
          {loading ? "Saving…" : changed ? "💾 Save Changes" : "✓ Saved"}
        </button>
      </div>

      {/* Role summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10, marginBottom: 20 }}>
        <div className="card" style={{ padding: "14px 18px", borderLeft: "3px solid #7C3AED" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
            <span>👑</span>
            <span style={{ fontWeight: 800, color: "#7C3AED" }}>OWNER</span>
          </div>
          <div style={{ fontSize: 12, color: "#64748B" }}>Full access to all {PAGES.length} features</div>
        </div>
        {ROLES.map(role => (
          <div key={role} className="card" style={{ padding: "14px 18px", borderLeft: `3px solid ${ROLE_META[role].color}` }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span>{ROLE_META[role].icon}</span>
                <span style={{ fontWeight: 800, color: ROLE_META[role].color }}>{role}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: ROLE_META[role].color }}>{roleCount(role)}/{PAGES.length}</span>
            </div>
            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 3 }}>{ROLE_META[role].desc}</div>
            {/* Copy from */}
            <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
              <span style={{ fontSize: 10, color: "#94A3B8", paddingTop: 3 }}>Copy from:</span>
              {ROLES.filter(r => r !== role).map(from => (
                <button key={from} className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: "2px 7px" }}
                  onClick={() => copyRole(from, role)}>{from}</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Presets */}
      <div className="card" style={{ marginBottom: 20, padding: "14px 18px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>⚡ Quick Presets:</span>
          {Object.keys(PRESETS).map(name => (
            <button key={name} className="btn btn-ghost btn-sm" onClick={() => applyPreset(name)}>{name}</button>
          ))}
          <span style={{ fontSize: 12, color: "#94A3B8", marginLeft: 4 }}>Presets only affect Manager, Cashier, Kitchen roles</span>
        </div>
      </div>

      {/* Permission matrix */}
      {CATS.map(cat => {
        const catPages = PAGES.filter(p => p.cat === cat);
        const isOpen   = openCat === cat;
        return (
          <div key={cat} className="card" style={{ marginBottom: 12 }}>
            {/* Category header */}
            <div onClick={() => setOpenCat(isOpen ? "" : cat)}
              style={{ padding: "14px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: 15 }}>{cat}</span>
                <span style={{ fontSize: 12, color: "#94A3B8", marginLeft: 8 }}>{catPages.length} features</span>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {ROLES.map(role => {
                  const on = catPages.filter(p => hasAccess(role, p.id)).length;
                  return (
                    <span key={role} style={{ fontSize: 11, color: ROLE_META[role].color, fontWeight: 700, background: `${ROLE_META[role].color}12`, borderRadius: 5, padding: "2px 7px" }}>
                      {on}/{catPages.length}
                    </span>
                  );
                })}
                <span style={{ fontSize: 12, color: "#94A3B8", marginLeft: 4 }}>{isOpen ? "▲" : "▼"}</span>
              </div>
            </div>

            {isOpen && (
              <div>
                {/* Column headers */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 110px 110px", padding: "8px 20px", background: "#F8FAFC", borderTop: "1px solid #E2E8F0", borderBottom: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Feature</span>
                  {ROLES.map(role => (
                    <div key={role} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: ROLE_META[role].color }}>{role}</div>
                      <button onClick={(e) => { e.stopPropagation(); toggleAll(role, cat); }}
                        style={{ fontSize: 9, color: ROLE_META[role].color, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>
                        {catPages.every(p => hasAccess(role, p.id)) ? "none" : "all"}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Page rows */}
                {catPages.map((page, idx) => (
                  <div key={page.id} style={{ display: "grid", gridTemplateColumns: "1fr 110px 110px 110px", padding: "10px 20px", borderBottom: idx < catPages.length - 1 ? "1px solid #F8FAFC" : "none", alignItems: "center" }}>
                    <div>
                      <span style={{ fontSize: 13 }}>{page.icon} {page.label}</span>
                      <div style={{ fontSize: 11, color: "#94A3B8" }}>{page.desc}</div>
                    </div>
                    {ROLES.map(role => (
                      <div key={role} style={{ textAlign: "center" }}>
                        <button onClick={() => toggle(role, page.id)}
                          style={{ width: 28, height: 28, borderRadius: 8, border: "2px solid", cursor: "pointer", transition: "all .15s", fontSize: 13,
                            borderColor: hasAccess(role, page.id) ? ROLE_META[role].color : "#E2E8F0",
                            background: hasAccess(role, page.id) ? ROLE_META[role].color : "#fff",
                            color: hasAccess(role, page.id) ? "#fff" : "#CBD5E1",
                          }}>
                          {hasAccess(role, page.id) ? "✓" : "—"}
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
