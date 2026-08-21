"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

/* ── Lucide-style SVG icon map ── */
const IC: Record<string, string> = {
  dashboard:  "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
  floor:      "M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z",
  tables:     "M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z",
  orders:     "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  kitchen:    "M12 2C8 2 4 5 4 9c0 3.1 1.8 5.8 4.5 7.1V18h7v-1.9C18.2 14.8 20 12.1 20 9c0-4-4-7-8-7z",
  bills:      "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM8 17h8v-1H8v1zm0-3h8v-1H8v1zm0-3h5v-1H8v1z",
  menu:       "M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7zm1-11H9v2h4v2H9v2h4v1h2v-1h1v-2h-1v-2h1V8h-1V7h-2v1z",
  inventory:  "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  purchord:   "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2m-4 0V3m0 2h4M9 12h6m-6 4h4",
  stock:      "M3 3h4v4H3zm7 0h4v4h-4zm7 0h4v4h-4zM3 10h4v4H3zm7 0h4v4h-4zm7 0h4v4h-4zM3 17h4v4H3zm7 0h4v4h-4zm7 0h4v4h-4z",
  expenses:   "M12 2a10 10 0 100 20A10 10 0 0012 2zm1 14H7v-2h6v2zm0-4H7v-2h6v2zm3-4H7V6h9v2z",
  delivery:   "M1 3h15v13H1zM16 8h4l3 3v5h-7V8zm3 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm-14 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
  customers:  "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm8 4v-1a4 4 0 00-3-3.87M23 21v-2a4 4 0 00-3-3.87",
  loyalty:    "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
  reserv:     "M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-2 .9-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm0 16H5V9h14v11zM7 11h5v5H7z",
  giftcard:   "M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zm0 12H4V9h16v10zM12 2C9.79 2 8 3.79 8 6h8c0-2.21-1.79-4-4-4z",
  discounts:  "M12.79 21L3 11.21v2c0 .53.21 1.04.59 1.41l7.79 7.79c.78.78 2.05.78 2.83 0l4.79-4.79c.78-.78.78-2.05 0-2.83L12.79 21zM4.59 12.83l7.79 7.79c.78.78 2.05.78 2.83 0l4.79-4.79c.78-.78.78-2.05 0-2.83L12.21 5.21C11.84 4.84 11.32 4.63 10.79 4.63L5 4.63c-1.1 0-2 .9-2 2v5.79c0 .53.21 1.04.59 1.41zM7.5 7C8.33 7 9 7.67 9 8.5S8.33 10 7.5 10 6 9.33 6 8.5 6.67 7 7.5 7z",
  reports:    "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  gst:        "M9 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-4m-5 0V5a2 2 0 012-2h2a2 2 0 012 2v2m-6 0h6",
  pnl:        "M7 12l5-5 5 5M7 17l5-5 5 5",
  staffrep:   "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  finance:    "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  dayclose:   "M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 0l-3-3m3 3l3-3m-3 3V8",
  settings:   "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
  users:      "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm8 4v-2a4 4 0 00-3-3.87",
  perms:      "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  actlog:     "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
  datamgmt:   "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4",
  import:     "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
  qr:         "M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h3v3h-3zM15 20h3v1h-3zM20 15h1v3h-1zM20 19h1v2h-1zM19 20h1v1h-1z",
  qrorders:   "M12 2a10 10 0 100 20A10 10 0 0012 2zm0 18a8 8 0 110-16 8 8 0 010 16zm0-14a4 4 0 00-4 4h2a2 2 0 014 0c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5a4 4 0 00-4-4zm-1 9h2v2h-2z",
  attend:     "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
};

function Icon({ k, size = 16 }: { k: string; size?: number }) {
  const d = IC[k] || IC.dashboard;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const NAV = [
  { section: "POS", items: [
    { href: "/dashboard/home",    label: "Dashboard",  icon: "dashboard" },
    { href: "/dashboard/floor",   label: "Floor View", icon: "floor" },
    { href: "/dashboard/tables",  label: "Tables",     icon: "tables" },
    { href: "/dashboard/orders",  label: "Orders",     icon: "orders" },
    { href: "/dashboard/kitchen", label: "Kitchen",    icon: "kitchen" },
    { href: "/dashboard/bills",   label: "Bills",      icon: "bills" },
  ]},
  { section: "Menu & Stock", items: [
    { href: "/dashboard/menu",            label: "Menu Items",     icon: "menu" },
    { href: "/dashboard/inventory",       label: "Inventory",      icon: "inventory" },
    { href: "/dashboard/purchase-orders", label: "Purchase Orders",icon: "purchord" },
    { href: "/dashboard/stock-ledger",    label: "Stock Ledger",   icon: "stock" },
    { href: "/dashboard/expenses",        label: "Expenses",       icon: "expenses" },
    { href: "/dashboard/delivery",        label: "Delivery",       icon: "delivery" },
  ]},
  { section: "Customers", items: [
    { href: "/dashboard/customers",    label: "Customers",    icon: "customers" },
    { href: "/dashboard/loyalty",      label: "Loyalty",      icon: "loyalty" },
    { href: "/dashboard/reservations", label: "Reservations", icon: "reserv" },
    { href: "/dashboard/gift-cards",   label: "Gift Cards",   icon: "giftcard" },
    { href: "/dashboard/discounts",    label: "Discounts",    icon: "discounts" },
  ]},
  { section: "Reports", items: [
    { href: "/dashboard/reports",      label: "Reports",      icon: "reports" },
    { href: "/dashboard/gst-report",   label: "GST Report",   icon: "gst" },
    { href: "/dashboard/pnl",          label: "P&L",          icon: "pnl" },
    { href: "/dashboard/staff-report", label: "Staff Report", icon: "staffrep" },
    { href: "/dashboard/finance",      label: "Finance",      icon: "finance" },
    { href: "/dashboard/day-close",    label: "Day Close",    icon: "dayclose" },
  ]},
  { section: "Settings", items: [
    { href: "/dashboard/settings",        label: "Settings",     icon: "settings" },
    { href: "/dashboard/users",           label: "Users",        icon: "users" },
    { href: "/dashboard/permissions",     label: "Permissions",  icon: "perms" },
    { href: "/dashboard/activity-log",    label: "Activity Log", icon: "actlog" },
    { href: "/dashboard/data-management", label: "Data Mgmt",    icon: "datamgmt" },
    { href: "/dashboard/import",          label: "Import",       icon: "import" },
    { href: "/dashboard/qr",              label: "QR Codes",     icon: "qr" },
    { href: "/dashboard/qr-orders",       label: "QR Orders",    icon: "qrorders" },
  ]},
];

/* Derive page title from pathname */
function getPageTitle(pathname: string): string {
  const all = NAV.flatMap(g => g.items);
  const match = all.find(i => pathname === i.href || pathname.startsWith(i.href + "/"));
  return match?.label ?? "Dashboard";
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [user, setUser] = useState<{ name?: string; email?: string; role?: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setUser(d); else router.replace("/login"); })
      .catch(() => router.replace("/login"));
  }, [router]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  const initials = user?.name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "RB";
  const pageTitle = getPageTitle(pathname);

  return (
    <div className="dl-root">
      {mobileOpen && <div className="dl-overlay" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={`dl-sidebar${collapsed ? " dl-collapsed" : ""}${mobileOpen ? " dl-mobile-open" : ""}`}>
        {/* Logo */}
        <div className="dl-logo">
          <div className="dl-logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="7" fill="url(#lg2)" />
              <path d="M6 8h12M6 12h8M6 16h10" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              <defs><linearGradient id="lg2" x1="0" y1="0" x2="24" y2="24"><stop stopColor="#6366f1" /><stop offset="1" stopColor="#8b5cf6" /></linearGradient></defs>
            </svg>
          </div>
          {!collapsed && <span className="dl-logo-text">RestoBill</span>}
          <button className="dl-collapse-btn dl-desktop-only" onClick={() => setCollapsed(v => !v)} aria-label="Toggle sidebar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform .25s" }}>
              <polyline points="15,18 9,12 15,6" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="dl-nav">
          {NAV.map(g => (
            <div key={g.section}>
              {!collapsed && <div className="dl-section">{g.section}</div>}
              {collapsed  && <div className="dl-section-div" />}
              {g.items.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link key={item.href} href={item.href}
                    className={`dl-navitem${active ? " dl-active" : ""}${collapsed ? " dl-icon-only" : ""}`}
                    title={collapsed ? item.label : undefined}
                    onClick={() => setMobileOpen(false)}>
                    <span className="dl-navicon"><Icon k={item.icon} size={16} /></span>
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="dl-foot">
          {user && (
            <div className={`dl-user${collapsed ? " dl-user-col" : ""}`}>
              <div className="dl-avatar">{initials}</div>
              {!collapsed && (
                <div className="dl-userinfo">
                  <div className="dl-username">{user.name || user.email || "User"}</div>
                  <div className="dl-userrole">{user.role || "Staff"}</div>
                </div>
              )}
              <button className="dl-logout" onClick={logout} title="Logout" aria-label="Logout">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16,17 21,12 16,7" /><line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className={`dl-main${collapsed ? " dl-main-full" : ""}`}>
        {/* Header */}
        <header className="dl-header">
          <button className="dl-menu-btn dl-mobile-only" onClick={() => setMobileOpen(v => !v)} aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Page title */}
          <div className="dl-header-title">{pageTitle}</div>

          <div className="dl-header-right">
            <div className="dl-header-date">
              {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
            </div>
            {user && (
              <div className="dl-header-user">
                <div className="dl-avatar dl-avatar-sm">{initials}</div>
              </div>
            )}
          </div>
        </header>

        <main className="dl-content">{children}</main>
      </div>

      <style jsx>{`
        .dl-root{display:flex;min-height:100vh;background:#06060f;color:#f8fafc;font-family:'Inter',system-ui,sans-serif}
        .dl-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);z-index:39;display:none}
        .dl-sidebar{width:256px;flex-shrink:0;position:fixed;top:0;left:0;bottom:0;z-index:40;display:flex;flex-direction:column;background:rgba(8,8,22,.85);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-right:1px solid rgba(255,255,255,.07);transition:width .25s ease;overflow:hidden}
        .dl-collapsed{width:66px}
        .dl-logo{display:flex;align-items:center;gap:10px;padding:16px 14px;border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0;min-height:58px}
        .dl-logo-icon{width:34px;height:34px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border-radius:9px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.25)}
        .dl-logo-text{font-size:16px;font-weight:800;white-space:nowrap;background:linear-gradient(135deg,#818cf8,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .dl-collapse-btn{margin-left:auto;background:none;border:none;color:#64748b;cursor:pointer;padding:4px;border-radius:6px;display:flex;align-items:center;flex-shrink:0;transition:color .15s,background .15s}
        .dl-collapse-btn:hover{color:#f8fafc;background:rgba(255,255,255,.07)}
        .dl-nav{flex:1;overflow-y:auto;padding:6px 8px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.08) transparent}
        .dl-section{font-size:10px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:#475569;padding:10px 8px 3px;margin-top:2px;white-space:nowrap}
        .dl-section-div{height:1px;background:rgba(255,255,255,.06);margin:6px 4px}
        :global(.dl-navitem){display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:9px;color:#94a3b8;font-size:13px;font-weight:500;text-decoration:none;border:1px solid transparent;transition:all .15s;white-space:nowrap;cursor:pointer}
        :global(.dl-navitem:hover){background:rgba(255,255,255,.05);color:#f8fafc;border-color:rgba(255,255,255,.07)}
        :global(.dl-active){background:linear-gradient(135deg,rgba(99,102,241,.2),rgba(139,92,246,.14));color:#818cf8;border-color:rgba(99,102,241,.28);box-shadow:0 0 10px rgba(99,102,241,.18)}
        :global(.dl-icon-only){justify-content:center;padding:9px 0}
        .dl-navicon{display:flex;align-items:center;justify-content:center;flex-shrink:0;opacity:.7;transition:opacity .15s}
        :global(.dl-active) .dl-navicon{opacity:1}
        .dl-foot{padding:10px 8px;border-top:1px solid rgba(255,255,255,.07);flex-shrink:0}
        .dl-user{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:11px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)}
        .dl-user-col{justify-content:center;padding:8px 6px}
        .dl-avatar{width:30px;height:30px;border-radius:8px;flex-shrink:0;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff}
        .dl-avatar-sm{width:28px;height:28px;border-radius:7px;font-size:10px}
        .dl-userinfo{flex:1;min-width:0}
        .dl-username{font-size:12px;font-weight:600;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .dl-userrole{font-size:10px;color:#64748b;white-space:nowrap;text-transform:capitalize}
        .dl-logout{background:none;border:none;color:#64748b;cursor:pointer;padding:4px;border-radius:6px;display:flex;align-items:center;flex-shrink:0;margin-left:auto;transition:color .15s,background .15s}
        .dl-logout:hover{color:#ef4444;background:rgba(239,68,68,.1)}
        .dl-main{flex:1;margin-left:256px;display:flex;flex-direction:column;min-height:100vh;transition:margin-left .25s ease}
        .dl-main-full{margin-left:66px}
        .dl-header{position:sticky;top:0;z-index:30;height:57px;background:rgba(6,6,15,.85);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;padding:0 24px;gap:12px}
        .dl-header-title{font-size:15px;font-weight:700;color:#f8fafc;letter-spacing:-0.1px}
        .dl-header-right{display:flex;align-items:center;gap:12px;margin-left:auto}
        .dl-header-date{font-size:12px;color:#64748b}
        .dl-header-user{display:flex;align-items:center}
        .dl-menu-btn{background:none;border:none;color:#94a3b8;cursor:pointer;padding:6px;border-radius:8px;transition:background .15s,color .15s;display:flex;align-items:center}
        .dl-menu-btn:hover{background:rgba(255,255,255,.07);color:#f8fafc}
        .dl-content{flex:1;padding:24px;overflow-x:hidden}
        .dl-desktop-only{} .dl-mobile-only{display:none}
        @media(max-width:768px){
          .dl-overlay{display:block}
          .dl-sidebar{transform:translateX(-100%);transition:transform .25s ease;width:256px!important}
          .dl-mobile-open{transform:translateX(0)}
          .dl-main,.dl-main-full{margin-left:0!important}
          .dl-desktop-only{display:none}
          .dl-mobile-only{display:flex}
          .dl-content{padding:16px}
          .dl-header{padding:0 16px}
          .dl-header-date{display:none}
        }
      `}</style>
    </div>
  );
}
