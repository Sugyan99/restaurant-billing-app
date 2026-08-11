"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ToastContainer } from "@/components/Toast";
import { AIAssistant } from "@/components/AIAssistant";
import NotificationBadge from "@/components/NotificationBadge";

const NAV: { title: string; items: { href: string; icon: string; label: string; badge?: boolean }[] }[] = [
  {
    title: "Operations",
    items: [
      { href: "/dashboard/home",           icon: "🏠", label: "Dashboard" },
      { href: "/dashboard/tables",         icon: "🪑", label: "Tables & POS" },
      { href: "/dashboard/orders",         icon: "🍳", label: "Kitchen / KOT", badge: true },
      { href: "/dashboard/kitchen",        icon: "👨‍🍳", label: "Kitchen Display" },
      { href: "/dashboard/bills",          icon: "🧾", label: "Bills & Payments" },
      { href: "/dashboard/qr-orders",       icon: "📱", label: "QR Orders",         badge: true },
      { href: "/dashboard/delivery",       icon: "🛵", label: "Delivery & Takeaway" },
      { href: "/dashboard/reservations",   icon: "📅", label: "Reservations" },
    ],
  },
  {
    title: "Management",
    items: [
      { href: "/dashboard/menu",           icon: "🍽️", label: "Menu & Import" },
      { href: "/dashboard/inventory",      icon: "📦", label: "Inventory & Stock" },
      { href: "/dashboard/purchase-orders",icon: "🛒", label: "Purchase Orders" },
      { href: "/dashboard/customers",      icon: "👤", label: "Customers & Loyalty" },
      { href: "/dashboard/gift-cards",     icon: "🎁", label: "Gift Cards" },
      { href: "/dashboard/finance",        icon: "💰", label: "Finance" },
    ],
  },
  {
    title: "Analytics",
    items: [
      { href: "/dashboard/reports",        icon: "📊", label: "Sales Reports" },
      { href: "/dashboard/gst-report",     icon: "🧾", label: "GST Report" },
      { href: "/dashboard/staff-report",   icon: "👨‍💼", label: "Staff Performance" },
      { href: "/dashboard/pnl",            icon: "💹", label: "P&L Statement" },
      { href: "/dashboard/activity-log",   icon: "📋", label: "Activity Log" },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/dashboard/users",          icon: "👥", label: "Staff" },
      { href: "/dashboard/permissions",    icon: "🔑", label: "Permissions" },
      { href: "/dashboard/settings",       icon: "⚙️",  label: "Settings & QR" },
      { href: "/dashboard/data-management",icon: "🗃️", label: "Data Management" },
    ],
  },
];

const allNav = NAV.flatMap(g => g.items);

type User = { name: string; role: string };
type SearchResult = { type: string; label: string; sub: string; id: string };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [user, setUser]               = useState<User | null>(null);
  const [allowedPages, setAllowedPages] = useState<string[]>(["*"]);
  const [openSection, setOpenSection] = useState<string>("Operations");
  const [query, setQuery]             = useState("");
  const [pendingCount, setPendingCount] = useState<number | undefined>(undefined);
  const [qrPending, setQrPending]       = useState<number>(0);
  const [results, setResults]         = useState<SearchResult[]>([]);
  const [searching, setSearching]     = useState(false);
  const [notifOpen, setNotifOpen]     = useState(false);
  const [notifs, setNotifs]           = useState<{id:string;title:string;message:string;type:string;isRead:boolean;createdAt:string}[]>([]);
  const [unread, setUnread]           = useState(0);

  useEffect(() => {
    const active = NAV.find(g => g.items.some(i => pathname.startsWith(i.href)));
    if (active) setOpenSection(active.title);
  }, [pathname]);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const d = await res.json();
      setResults(d.results ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (!d.user) return;
      setUser(d.user);
      if (d.user.role === "OWNER") {
        setAllowedPages(["*"]);
      } else {
        fetch("/api/permissions").then(r => r.json()).then(p => {
          setAllowedPages(p.permissions?.[d.user.role] ?? []);
        }).catch(() => setAllowedPages(["home","tables","floor","orders","bills"]));
      }
    });
    const loadBadge = () => {
      fetch("/api/orders?status=PENDING").then(r => r.json()).then(d => setPendingCount(d.orders?.length ?? 0)).catch(() => setPendingCount(0));
      fetch("/api/qr/pending").then(r => r.json()).then(d => setQrPending(d.orders?.length ?? 0)).catch(() => setQrPending(0));
    };
    const loadNotifs = () => fetch("/api/notifications").then(r => r.json()).then(d => { setNotifs(d.notifications ?? []); setUnread(d.unreadCount ?? 0); }).catch(() => {});
    loadBadge(); loadNotifs();
    const iv = setInterval(() => { loadBadge(); loadNotifs(); }, 20000);
    return () => clearInterval(iv);
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PUT" });
    setUnread(0); setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function canAccess(href: string) {
    if (allowedPages.includes("*")) return true;
    const pageId = href.replace("/dashboard/", "");
    return allowedPages.includes(pageId);
  }

  useEffect(() => {
    if (!user || allowedPages.includes("*")) return;
    const pageId = pathname.replace("/dashboard/", "").split("/")[0];
    if (pageId && pageId !== "home" && !allowedPages.includes(pageId)) router.push("/dashboard/home");
  }, [pathname, allowedPages, user, router]);

  const currentPage = allNav.find(n => pathname.startsWith(n.href));

  return (
    <div>
      <aside className="sidebar" aria-label="Main sidebar">
        <div className="sidebar-logo">
          <h1>🍽️ RestoBill</h1>
          <p>Restaurant POS</p>
        </div>

        <nav className="sidebar-nav" style={{ overflowY: "auto", flex: 1 }} role="navigation">
          {NAV.map(group => {
            const visible = group.items.filter(i => canAccess(i.href));
            if (visible.length === 0) return null;
            const isOpen   = openSection === group.title;
            const hasActive = visible.some(i => pathname.startsWith(i.href));

            return (
              <div key={group.title}>
                <button
                  onClick={() => setOpenSection(isOpen ? "" : group.title)}
                  aria-expanded={isOpen}
                  style={{
                    width: "100%", background: "none", border: "none", cursor: "pointer",
                    padding: "9px 16px", display: "flex", justifyContent: "space-between",
                    alignItems: "center", color: hasActive ? "#E8721C" : "#4A5A72",
                    fontSize: 10, fontWeight: 700, letterSpacing: .7, textTransform: "uppercase",
                    borderLeft: hasActive && !isOpen ? "2px solid #E8721C" : "2px solid transparent",
                    transition: "all .15s",
                  }}
                >
                  <span>{group.title}</span>
                  <span style={{ fontSize: 9, opacity: .6 }}>{isOpen ? "▲" : "▼"}</span>
                </button>

                <div style={{
                  maxHeight: isOpen ? `${visible.length * 44}px` : "0px",
                  overflow: "hidden",
                  transition: "max-height 220ms ease",
                }}>
                  {visible.map(item => {
                    const active = pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`nav-item ${active ? "active" : ""}`}
                        aria-current={active ? "page" : undefined}
                      >
                        <span style={{ fontSize: 15 }}>{item.icon}</span>
                        <span style={{ flex: 1 }}>{item.label}</span>
                        {item.badge && (() => {
                          const cnt = item.href.includes("qr-orders") ? qrPending : pendingCount;
                          return <NotificationBadge count={cnt} showDot={cnt === 0} ariaLabel={`${cnt ?? 0} pending`} />;
                        })()}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div style={{ borderTop: "1px solid #1E2D42", padding: "12px 16px", flexShrink: 0 }}>
          {user && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#CBD5E1", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.name}</div>
              <div style={{ fontSize: 10, color: "#3A4A62", fontWeight: 600 }}>{user.role}</div>
            </div>
          )}
          <button onClick={logout} style={{
            background: "#1E2D42", border: "none", width: "100%", cursor: "pointer",
            color: "#94A3B8", fontSize: 12, padding: "7px 0", borderRadius: 6,
            display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
            transition: "all 0.15s",
          }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#DC2626"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#1E2D42"}
          >
            <span>🚪</span><span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="topbar-title">{currentPage?.icon} {currentPage?.label ?? "Dashboard"}</span>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="🔍 Search..."
                onBlur={() => setTimeout(() => setQuery(""), 200)}
                style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, width: 200, outline: "none" }} />
              {(searching || results.length > 0) && (
                <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "white", border: "1px solid #E2E8F0", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", width: 320, zIndex: 300 }}>
                  {searching && <div style={{ padding: "12px 16px", fontSize: 12, color: "#94A3B8" }}>Searching…</div>}
                  {results.map((r, i) => (
                    <div key={i} style={{ padding: "10px 14px", borderBottom: "1px solid #F1F5F9", cursor: "pointer", fontSize: 12 }} onMouseDown={() => setQuery("")}>
                      <div style={{ fontWeight: 600 }}>{r.label}</div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>{r.type} · {r.sub}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <span style={{ fontSize: 12, color: "#94A3B8" }}>
              {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>

            <div style={{ position: "relative" }}>
              <button onClick={() => { setNotifOpen(o => !o); if (!notifOpen && unread > 0) markAllRead(); }}
                style={{ background: "none", border: "1px solid #E2E8F0", borderRadius: 8, padding: "5px 9px", cursor: "pointer", fontSize: 16, position: "relative", display: "flex", alignItems: "center" }}>
                🔔
                {unread > 0 && (
                  <span style={{ position: "absolute", top: -4, right: -4, background: "#DC2626", color: "white", borderRadius: "50%", fontSize: 9, fontWeight: 800, width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 320, background: "white", border: "1px solid #E2E8F0", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.14)", zIndex: 200, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>Notifications</span>
                    <button onClick={markAllRead} style={{ background: "none", border: "none", fontSize: 11, color: "#E8721C", cursor: "pointer", fontWeight: 600 }}>Mark all read</button>
                  </div>
                  <div style={{ maxHeight: 340, overflowY: "auto" }}>
                    {notifs.length === 0
                      ? <div style={{ padding: "24px 16px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>No notifications</div>
                      : notifs.map(n => (
                        <div key={n.id} style={{ padding: "10px 16px", borderBottom: "1px solid #F8FAFC", background: n.isRead ? "white" : "#FFF7ED", display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <span style={{ fontSize: 16, flexShrink: 0 }}>{n.type==="ERROR"?"🔴":n.type==="SUCCESS"?"✅":n.type==="WARNING"?"⚠️":"ℹ️"}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 2 }}>{n.title}</div>
                            <div style={{ fontSize: 11, color: "#64748B", lineHeight: 1.4 }}>{n.message}</div>
                            <div style={{ fontSize: 10, color: "#CBD5E1", marginTop: 4 }}>{new Date(n.createdAt).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</div>
                          </div>
                          {!n.isRead && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#E8721C", flexShrink: 0, marginTop: 4 }} />}
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>

            {user && (
              <div style={{ background: "#FFF0E5", border: "1px solid #FDBA74", borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 700, color: "#E8721C" }}>
                {user.role}
              </div>
            )}
          </div>
        </div>

        <div className="page-body">{children}</div>
      </main>

      <ToastContainer />
      <AIAssistant />
    </div>
  );
}
