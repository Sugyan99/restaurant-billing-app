"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

const NAV = [
  { section:"POS", items:[
    { href:"/dashboard/home",    label:"Dashboard",  icon:"⊞" },
    { href:"/dashboard/floor",   label:"Floor View", icon:"◫" },
    { href:"/dashboard/tables",  label:"Tables",     icon:"▦" },
    { href:"/dashboard/orders",  label:"Orders",     icon:"◳" },
    { href:"/dashboard/kitchen", label:"Kitchen",    icon:"◉" },
    { href:"/dashboard/bills",   label:"Bills",      icon:"◈" },
  ]},
  { section:"Menu & Stock", items:[
    { href:"/dashboard/menu",           label:"Menu Items",     icon:"◐" },
    { href:"/dashboard/inventory",      label:"Inventory",      icon:"◧" },
    { href:"/dashboard/purchase-orders",label:"Purchase Orders",icon:"◫" },
    { href:"/dashboard/stock-ledger",   label:"Stock Ledger",   icon:"◱" },
    { href:"/dashboard/expenses",       label:"Expenses",       icon:"◎" },
    { href:"/dashboard/delivery",       label:"Delivery",       icon:"◌" },
  ]},
  { section:"Customers", items:[
    { href:"/dashboard/customers",    label:"Customers",    icon:"◯" },
    { href:"/dashboard/loyalty",      label:"Loyalty",      icon:"◈" },
    { href:"/dashboard/reservations", label:"Reservations", icon:"◷" },
    { href:"/dashboard/gift-cards",   label:"Gift Cards",   icon:"◆" },
    { href:"/dashboard/discounts",    label:"Discounts",    icon:"◇" },
  ]},
  { section:"Reports", items:[
    { href:"/dashboard/reports",      label:"Reports",      icon:"◭" },
    { href:"/dashboard/gst-report",   label:"GST Report",   icon:"◮" },
    { href:"/dashboard/pnl",          label:"P&L",          icon:"◬" },
    { href:"/dashboard/staff-report", label:"Staff Report", icon:"◫" },
    { href:"/dashboard/finance",      label:"Finance",      icon:"◉" },
    { href:"/dashboard/day-close",    label:"Day Close",    icon:"◑" },
  ]},
  { section:"Settings", items:[
    { href:"/dashboard/settings",         label:"Settings",     icon:"◌" },
    { href:"/dashboard/users",            label:"Users",        icon:"◯" },
    { href:"/dashboard/permissions",      label:"Permissions",  icon:"◈" },
    { href:"/dashboard/activity-log",     label:"Activity Log", icon:"◎" },
    { href:"/dashboard/data-management",  label:"Data Mgmt",    icon:"◧" },
    { href:"/dashboard/import",           label:"Import",       icon:"◱" },
    { href:"/dashboard/qr",              label:"QR Codes",     icon:"◫" },
    { href:"/dashboard/qr-orders",       label:"QR Orders",    icon:"◌" },
  ]},
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<{name?:string;email?:string;role?:string}|null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setUser(d); else router.replace("/login"); })
      .catch(() => router.replace("/login"));
  }, [router]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method:"POST" });
    router.replace("/login");
  };

  const initials = user?.name?.split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2) || "RB";

  return (
    <div className="dl-root">
      {/* Mobile overlay */}
      {mobileOpen && <div className="dl-overlay" onClick={()=>setMobileOpen(false)}/>}

      {/* Sidebar */}
      <aside className={`dl-sidebar${collapsed?" dl-collapsed":""}${mobileOpen?" dl-mobile-open":""}`}>
        {/* Logo */}
        <div className="dl-logo">
          <div className="dl-logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="7" fill="url(#lg)"/>
              <path d="M6 8h12M6 12h8M6 16h10" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
              <defs><linearGradient id="lg" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse"><stop stopColor="#6366f1"/><stop offset="1" stopColor="#8b5cf6"/></linearGradient></defs>
            </svg>
          </div>
          {!collapsed && <span className="dl-logo-text">RestoBill</span>}
          <button className="dl-collapse-btn dl-desktop-only" onClick={()=>setCollapsed(v=>!v)} aria-label="Toggle sidebar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{transform:collapsed?"rotate(180deg)":"none",transition:"transform .25s"}}>
              <polyline points="15,18 9,12 15,6"/>
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="dl-nav">
          {NAV.map(g => (
            <div key={g.section}>
              {!collapsed && <div className="dl-section">{g.section}</div>}
              {collapsed && <div className="dl-section-div"/>}
              {g.items.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href+"/");
                return (
                  <Link key={item.href} href={item.href}
                    className={`dl-navitem${active?" dl-active":""}${collapsed?" dl-icon-only":""}`}
                    title={collapsed?item.label:undefined}
                    onClick={()=>setMobileOpen(false)}>
                    <span className="dl-navicon" aria-hidden="true">{item.icon}</span>
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
            <div className={`dl-user${collapsed?" dl-user-col":""}`}>
              <div className="dl-avatar">{initials}</div>
              {!collapsed && (
                <div className="dl-userinfo">
                  <div className="dl-username">{user.name||user.email||"User"}</div>
                  <div className="dl-userrole">{user.role||"Staff"}</div>
                </div>
              )}
              <button className="dl-logout" onClick={logout} title="Logout" aria-label="Logout">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main area */}
      <div className={`dl-main${collapsed?" dl-main-full":""}`}>
        {/* Header */}
        <header className="dl-header">
          <button className="dl-menu-btn dl-mobile-only" onClick={()=>setMobileOpen(v=>!v)} aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="dl-header-date">
            {new Date().toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}
          </div>
        </header>
        <main className="dl-content">{children}</main>
      </div>

      <style jsx>{`
        .dl-root{display:flex;min-height:100vh;background:#06060f;color:#f8fafc;font-family:'Inter',system-ui,sans-serif}
        .dl-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);z-index:39;display:none}
        .dl-sidebar{width:256px;flex-shrink:0;position:fixed;top:0;left:0;bottom:0;z-index:40;display:flex;flex-direction:column;background:rgba(8,8,22,.82);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-right:1px solid rgba(255,255,255,.07);transition:width .25s ease;overflow:hidden}
        .dl-collapsed{width:66px}
        .dl-logo{display:flex;align-items:center;gap:10px;padding:16px 14px;border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0;min-height:58px}
        .dl-logo-icon{width:34px;height:34px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border-radius:9px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.25)}
        .dl-logo-text{font-size:16px;font-weight:800;white-space:nowrap;background:linear-gradient(135deg,#818cf8,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .dl-collapse-btn{margin-left:auto;background:none;border:none;color:#64748b;cursor:pointer;padding:4px;border-radius:6px;display:flex;align-items:center;flex-shrink:0;transition:color .15s,background .15s}
        .dl-collapse-btn:hover{color:#f8fafc;background:rgba(255,255,255,.07)}
        .dl-nav{flex:1;overflow-y:auto;padding:6px 8px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.08) transparent}
        .dl-section{font-size:10px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:#475569;padding:8px 8px 3px;margin-top:4px;white-space:nowrap}
        .dl-section-div{height:1px;background:rgba(255,255,255,.06);margin:6px 4px}
        :global(.dl-navitem){display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:9px;color:#94a3b8;font-size:13px;font-weight:500;text-decoration:none;border:1px solid transparent;transition:all .15s;white-space:nowrap;cursor:pointer}
        :global(.dl-navitem:hover){background:rgba(255,255,255,.05);color:#f8fafc;border-color:rgba(255,255,255,.07)}
        :global(.dl-active){background:linear-gradient(135deg,rgba(99,102,241,.2),rgba(139,92,246,.14));color:#818cf8;border-color:rgba(99,102,241,.28);box-shadow:0 0 10px rgba(99,102,241,.18)}
        :global(.dl-icon-only){justify-content:center;padding:9px 0}
        .dl-navicon{font-size:15px;flex-shrink:0;font-style:normal;line-height:1;opacity:.7}
        :global(.dl-active) .dl-navicon{opacity:1}
        .dl-foot{padding:10px 8px;border-top:1px solid rgba(255,255,255,.07);flex-shrink:0}
        .dl-user{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:11px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)}
        .dl-user-col{justify-content:center;padding:8px 6px}
        .dl-avatar{width:30px;height:30px;border-radius:8px;flex-shrink:0;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff}
        .dl-userinfo{flex:1;min-width:0}
        .dl-username{font-size:12px;font-weight:600;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .dl-userrole{font-size:10px;color:#64748b;white-space:nowrap;text-transform:capitalize}
        .dl-logout{background:none;border:none;color:#64748b;cursor:pointer;padding:4px;border-radius:6px;display:flex;align-items:center;flex-shrink:0;margin-left:auto;transition:color .15s,background .15s}
        .dl-logout:hover{color:#ef4444;background:rgba(239,68,68,.1)}
        .dl-main{flex:1;margin-left:256px;display:flex;flex-direction:column;min-height:100vh;transition:margin-left .25s ease}
        .dl-main-full{margin-left:66px}
        .dl-header{position:sticky;top:0;z-index:30;height:57px;background:rgba(6,6,15,.82);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;padding:0 24px;gap:12px}
        .dl-header-date{font-size:12px;color:#64748b;margin-left:auto}
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
        }
      `}</style>
    </div>
  );
}
