"use client";
import { useState, useEffect } from "react";
import { showToast } from "@/components/Toast";

type Perms = Record<string, string[]>;

const PAGES = [
  { id: "home", label: "Dashboard", icon: "🏠", cat: "Operations" },
  { id: "tables", label: "Tables & POS", icon: "🪑", cat: "Operations" },
  { id: "orders", label: "Kitchen / KOT", icon: "🍳", cat: "Operations" },
  { id: "bills", label: "Bills & Payments", icon: "🧾", cat: "Operations" },
  { id: "reservations", label: "Reservations", icon: "📅", cat: "Operations" },
  { id: "menu", label: "Menu", icon: "🍽️", cat: "Management" },
  { id: "inventory", label: "Inventory", icon: "📦", cat: "Management" },
  { id: "stock-ledger", label: "Stock Ledger", icon: "📊", cat: "Management" },
  { id: "customers", label: "Customers", icon: "👤", cat: "Management" },
  { id: "discounts", label: "Discounts", icon: "🏷️", cat: "Management" },
  { id: "expenses", label: "Expenses", icon: "💰", cat: "Management" },
  { id: "day-close", label: "Day Close", icon: "🔒", cat: "Management" },
  { id: "import", label: "Import Menu", icon: "⬆️", cat: "Management" },
  { id: "qr", label: "Table QR Codes", icon: "📱", cat: "Management" },
  { id: "reports", label: "Sales Reports", icon: "📊", cat: "Analytics" },
  { id: "gst-report", label: "GST Report", icon: "🧾", cat: "Analytics" },
  { id: "staff-report", label: "Staff Performance", icon: "👨‍💼", cat: "Analytics" },
  { id: "pnl", label: "P&L Statement", icon: "💹", cat: "Analytics" },
  { id: "users", label: "Staff Management", icon: "👥", cat: "Admin" },
  { id: "permissions", label: "Permissions", icon: "🔑", cat: "Admin" },
  { id: "data-management", label: "Data Management", icon: "🗃️", cat: "Admin" },
  { id: "settings", label: "Settings", icon: "⚙️", cat: "Admin" },
];

const CATS = ["Operations", "Management", "Analytics", "Admin"];
const ROLES = ["MANAGER", "CASHIER", "KITCHEN"];
const ROLE_COLORS: Record<string, string> = { MANAGER: "#2563EB", CASHIER: "#16A34A", KITCHEN: "#D97706" };

export default function PermissionsPage() {
  const [perms, setPerms] = useState<Perms>({});
  const [loading, setLoading] = useState(false);
  const [openCat, setOpenCat] = useState<string>("Operations");

  useEffect(() => {
    fetch("/api/permissions").then(r => r.json()).then(d => setPerms(d.permissions ?? {}));
  }, []);

  function toggle(role: string, pageId: string) {
    setPerms(prev => {
      const current = prev[role] ?? [];
      const has = current.includes(pageId);
      return { ...prev, [role]: has ? current.filter(x => x !== pageId) : [...current, pageId] };
    });
  }

  function toggleAll(role: string, cat: string) {
    const catPages = PAGES.filter(p => p.cat === cat).map(p => p.id);
    const current = perms[role] ?? [];
    const allOn = catPages.every(p => current.includes(p));
    setPerms(prev => ({
      ...prev,
      [role]: allOn ? current.filter(p => !catPages.includes(p)) : [...new Set([...current, ...catPages])],
    }));
  }

  function hasAccess(role: string, pageId: string) {
    const r = perms[role] ?? [];
    return r.includes("*") || r.includes(pageId);
  }

  async function save() {
    setLoading(true);
    const res = await fetch("/api/permissions", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions: perms }),
    });
    if (res.ok) showToast("Permissions saved!");
    else showToast("Failed to save", "error");
    setLoading(false);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Permission Manager</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>Control what each role can access</p>
        </div>
        <button className="btn btn-primary" onClick={save} disabled={loading}>
          {loading ? "Saving..." : "💾 Save Permissions"}
        </button>
      </div>

      {/* Role legend */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        {ROLES.map(role => (
          <div key={role} style={{ background: `${ROLE_COLORS[role]}15`, border: `1px solid ${ROLE_COLORS[role]}30`, borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, color: ROLE_COLORS[role] }}>
            {role === "MANAGER" ? "🏪" : role === "CASHIER" ? "💳" : "👨‍🍳"} {role}
          </div>
        ))}
        <div style={{ background: "#7C3AED15", border: "1px solid #7C3AED30", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, color: "#7C3AED" }}>
          👑 OWNER — Always Full Access
        </div>
      </div>

      {/* Category accordions */}
      {CATS.map(cat => {
        const catPages = PAGES.filter(p => p.cat === cat);
        const isOpen = openCat === cat;
        return (
          <div key={cat} className="card" style={{ marginBottom: 12 }}>
            <div className="card-header" style={{ cursor: "pointer" }} onClick={() => setOpenCat(isOpen ? "" : cat)}>
              <h3 className="card-title">{cat} ({catPages.length} features)</h3>
              <span style={{ fontSize: 12, color: "#94A3B8" }}>{isOpen ? "▲ Collapse" : "▼ Expand"}</span>
            </div>
            {isOpen && (
              <div style={{ padding: "0 0 8px" }}>
                {/* Header row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px 120px", gap: 8, padding: "8px 20px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>FEATURE</span>
                  {ROLES.map(role => (
                    <div key={role} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: ROLE_COLORS[role] }}>{role}</div>
                      <button onClick={() => toggleAll(role, cat)} style={{ fontSize: 10, color: "#94A3B8", background: "none", border: "none", cursor: "pointer" }}>
                        toggle all
                      </button>
                    </div>
                  ))}
                </div>
                {catPages.map(page => (
                  <div key={page.id} style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px 120px", gap: 8, padding: "10px 20px", borderBottom: "1px solid #F1F5F9", alignItems: "center" }}>
                    <span style={{ fontSize: 13 }}>{page.icon} {page.label}</span>
                    {ROLES.map(role => (
                      <div key={role} style={{ textAlign: "center" }}>
                        <button
                          onClick={() => toggle(role, page.id)}
                          style={{
                            width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer",
                            background: hasAccess(role, page.id) ? ROLE_COLORS[role] : "#E2E8F0",
                            transition: "all 0.2s", position: "relative",
                          }}
                        >
                          <span style={{
                            position: "absolute", top: 2, left: hasAccess(role, page.id) ? 18 : 2,
                            width: 16, height: 16, borderRadius: "50%", background: "white",
                            transition: "left 0.2s", display: "block"
                          }} />
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
