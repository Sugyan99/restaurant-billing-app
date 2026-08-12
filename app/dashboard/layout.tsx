"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ToastContainer } from "@/components/Toast";
import { AIAssistant } from "@/components/AIAssistant";
import NotificationBadge from "@/components/NotificationBadge";
import { PremiumUI, ThemeToggle } from "@/components/PremiumUI";

const NAV: { title: string; items: { href: string; icon: string; label: string; badge?: boolean }[] }[] = [
  { title: "Operations", items: [
    { href: "/dashboard/home", icon: "🏠", label: "Dashboard" }, { href: "/dashboard/tables", icon: "🪑", label: "Tables & POS" },
    { href: "/dashboard/orders", icon: "🍳", label: "Kitchen / KOT", badge: true }, { href: "/dashboard/kitchen", icon: "👨‍🍳", label: "Kitchen Display" },
    { href: "/dashboard/bills", icon: "🧾", label: "Bills & Payments" }, { href: "/dashboard/qr-orders", icon: "📱", label: "QR Orders", badge: true },
    { href: "/dashboard/delivery", icon: "🛵", label: "Delivery & Takeaway" }, { href: "/dashboard/reservations", icon: "📅", label: "Reservations" },
  ] },
  { title: "Management", items: [
    { href: "/dashboard/menu", icon: "🍽️", label: "Menu & Import" }, { href: "/dashboard/inventory", icon: "📦", label: "Inventory & Stock" },
    { href: "/dashboard/purchase-orders", icon: "🛒", label: "Purchase Orders" }, { href: "/dashboard/customers", icon: "👤", label: "Customers & Loyalty" },
    { href: "/dashboard/gift-cards", icon: "🎁", label: "Gift Cards" }, { href: "/dashboard/finance", icon: "💰", label: "Finance" },
  ] },
  { title: "Analytics", items: [
    { href: "/dashboard/reports", icon: "📊", label: "Sales Reports" }, { href: "/dashboard/gst-report", icon: "🧾", label: "GST Report" },
    { href: "/dashboard/staff-report", icon: "👨‍💼", label: "Staff Performance" }, { href: "/dashboard/pnl", icon: "💹", label: "P&L Statement" },
    { href: "/dashboard/activity-log", icon: "📋", label: "Activity Log" },
  ] },
  { title: "Admin", items: [
    { href: "/dashboard/users", icon: "👥", label: "Staff" }, { href: "/dashboard/permissions", icon: "🔑", label: "Permissions" },
    { href: "/dashboard/settings", icon: "⚙️", label: "Settings & QR" }, { href: "/dashboard/data-management", icon: "🗃️", label: "Data Management" },
  ] },
];
const allNav = NAV.flatMap(g => g.items);
type User = { name: string; role: string };
type SearchResult = { type: string; label: string; sub: string; id: string };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter();
  const [user, setUser] = useState<User | null>(null); const [allowedPages, setAllowedPages] = useState<string[]>(["*"]);
  const [openSection, setOpenSection] = useState("Operations"); const [query, setQuery] = useState("");
  const [pendingCount, setPendingCount] = useState<number | undefined>(); const [qrPending, setQrPending] = useState(0);
  const [results, setResults] = useState<SearchResult[]>([]); const [searching, setSearching] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<{id:string;title:string;message:string;type:string;isRead:boolean;createdAt:string}[]>([]); const [unread, setUnread] = useState(0);

  useEffect(() => { const active = NAV.find(g => g.items.some(i => pathname.startsWith(i.href))); if (active) setOpenSection(active.title); }, [pathname]);
  useEffect(() => { if (query.length < 2) { setResults([]); return; } const t = setTimeout(async () => { setSearching(true); try { const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`); const d = await res.json(); setResults(d.results ?? []); } finally { setSearching(false); } }, 300); return () => clearTimeout(t); }, [query]);
  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => { if (!d.user) return; setUser(d.user); if (d.user.role !== "OWNER") fetch("/api/permissions").then(r => r.json()).then(p => setAllowedPages(p.permissions?.[d.user.role] ?? [])).catch(() => setAllowedPages(["home","tables","floor","orders","bills"])); });
    const loadBadge = () => { fetch("/api/orders?status=PENDING").then(r=>r.json()).then(d=>setPendingCount(d.orders?.length ?? 0)).catch(()=>setPendingCount(0)); fetch("/api/qr/pending").then(r=>r.json()).then(d=>setQrPending(d.orders?.length ?? 0)).catch(()=>setQrPending(0)); };
    const loadNotifs = () => fetch("/api/notifications").then(r=>r.json()).then(d=>{setNotifs(d.notifications??[]);setUnread(d.unreadCount??0)}).catch(()=>{});
    loadBadge(); loadNotifs(); const iv=setInterval(()=>{loadBadge();loadNotifs()},20000); return ()=>clearInterval(iv);
  }, []);
  async function markAllRead(){ await fetch("/api/notifications",{method:"PUT"}); setUnread(0); setNotifs(prev=>prev.map(n=>({...n,isRead:true}))); }
  async function logout(){ await fetch("/api/auth/logout",{method:"POST"}); router.push("/login"); }
  function canAccess(href:string){ if(allowedPages.includes("*")) return true; return allowedPages.includes(href.replace("/dashboard/","")); }
  useEffect(()=>{ if(!user||allowedPages.includes("*"))return; const pageId=pathname.replace("/dashboard/","").split("/")[0]; if(pageId&&pageId!=="home"&&!allowedPages.includes(pageId))router.push("/dashboard/home"); },[pathname,allowedPages,user,router]);
  const currentPage=allNav.find(n=>pathname.startsWith(n.href));

  return <div className="dashboard-shell">
    <aside className="sidebar" aria-label="Main sidebar">
      <div className="sidebar-logo"><div className="brand-mark">🍽️</div><div><h1>RestoBill</h1><p>Restaurant POS</p></div></div>
      <nav className="sidebar-nav" role="navigation">
        {NAV.map(group=>{ const visible=group.items.filter(i=>canAccess(i.href)); if(!visible.length)return null; const isOpen=openSection===group.title; const hasActive=visible.some(i=>pathname.startsWith(i.href)); return <div className="nav-group" key={group.title}>
          <button className={`nav-section-toggle ${hasActive?"has-active":""}`} onClick={()=>setOpenSection(isOpen?"":group.title)} aria-expanded={isOpen}><span>{group.title}</span><span className={`chevron ${isOpen?"open":""}`}>⌄</span></button>
          <div className="nav-group-items" style={{maxHeight:isOpen?`${visible.length*44}px`:0}}>{visible.map(item=>{const active=pathname.startsWith(item.href);return <Link key={item.href} href={item.href} className={`nav-item ${active?"active":""}`} aria-current={active?"page":undefined}><span className="nav-icon">{item.icon}</span><span className="nav-label">{item.label}</span>{item.badge&&<NotificationBadge count={item.href.includes("qr-orders")?qrPending:pendingCount} showDot={false} ariaLabel="pending"/>}</Link>})}</div>
        </div>})}
      </nav>
      <div className="sidebar-footer">{user&&<div className="user-mini"><div className="avatar">{user.name.slice(0,1).toUpperCase()}</div><div><strong>{user.name}</strong><small>{user.role}</small></div></div>}<button className="logout-button" onClick={logout}>🚪 <span>Logout</span></button></div>
    </aside>

    <main className="main-content">
      <div className="topbar">
        <div className="topbar-left"><button className="mobile-menu-button" aria-label="Toggle navigation">☰</button><span className="breadcrumb-muted">RestoBill</span><span className="breadcrumb-sep">/</span><span className="topbar-title">{currentPage?.label??"Dashboard"}</span></div>
        <div className="topbar-actions">
          <button className="command-trigger" onClick={()=>window.dispatchEvent(new KeyboardEvent("keydown",{key:"k",ctrlKey:true}))}><span>⌕</span><span>Search</span><kbd>Ctrl K</kbd></button>
          <span className="topbar-date">{new Date().toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</span>
          <ThemeToggle />
          <div className="notification-wrap"><button className="ui-icon-button" onClick={()=>{setNotifOpen(o=>!o);if(!notifOpen&&unread>0)markAllRead()}} aria-label="Notifications">🔔{unread>0&&<span className="notification-dot">{unread>9?"9+":unread}</span>}</button>{notifOpen&&<div className="notification-popover"><div className="popover-head"><strong>Notifications</strong><button onClick={markAllRead}>Mark all read</button></div><div className="notification-list">{notifs.length===0?<div className="empty-state">No notifications</div>:notifs.map(n=><div key={n.id} className={`notification-row ${n.isRead?"":"unread"}`}><span>{n.type==="ERROR"?"🔴":n.type==="SUCCESS"?"✅":n.type==="WARNING"?"⚠️":"ℹ️"}</span><div><strong>{n.title}</strong><p>{n.message}</p><small>{new Date(n.createdAt).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</small></div></div>)}</div></div>}</div>
          {user&&<span className="role-pill">{user.role}</span>}
        </div>
      </div>
      <div key={pathname} className="page-transition page-body">{children}</div>
    </main>
    <PremiumUI />
    <ToastContainer />
    <AIAssistant />
  </div>;
}
