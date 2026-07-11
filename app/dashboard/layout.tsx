"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ToastContainer } from "@/components/Toast";
import { AIAssistant } from "@/components/AIAssistant";

const NAV_MAIN = [
  { href: "/dashboard/home", icon: "🏠", label: "Dashboard" },
  { href: "/dashboard/tables", icon: "🪑", label: "Tables & POS" },
  { href: "/dashboard/orders", icon: "🍳", label: "Kitchen / KOT" },
  { href: "/dashboard/bills", icon: "🧾", label: "Bills & Payments" },
];
const NAV_MANAGE = [
  { href: "/dashboard/menu", icon: "🍽️", label: "Menu" },
  { href: "/dashboard/inventory", icon: "📦", label: "Inventory" },
  { href: "/dashboard/reservations", icon: "📅", label: "Reservations" },
  { href: "/dashboard/customers", icon: "👤", label: "Customers" },
  { href: "/dashboard/discounts", icon: "🏷️", label: "Discounts" },
  { href: "/dashboard/expenses", icon: "💰", label: "Expenses" },
  { href: "/dashboard/day-close", icon: "🔒", label: "Day Close" },
];
const NAV_REPORTS = [
  { href: "/dashboard/reports", icon: "📊", label: "Sales Reports" },
  { href: "/dashboard/gst-report", icon: "🧾", label: "GST Report" },
  { href: "/dashboard/staff-report", icon: "👨‍💼", label: "Staff Performance" },
];
const NAV_ADMIN = [
  { href: "/dashboard/users", icon: "👥", label: "Staff" },
  { href: "/dashboard/settings", icon: "⚙️", label: "Settings" },
];

const allNav = [...NAV_MAIN, ...NAV_MANAGE, ...NAV_REPORTS, ...NAV_ADMIN];

type User = { name: string; role: string };
type SearchResult = { type: string; label: string; sub: string; id: string };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

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
    fetch("/api/auth/me").then(r => r.json()).then(d => { if (d.user) setUser(d.user); });
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const currentPage = allNav.find(n => pathname.startsWith(n.href));

  function NavSection({ title, items }: { title: string; items: typeof NAV_MAIN }) {
    return (
      <>
        <div className="nav-section">{title}</div>
        {items.map(item => (
          <Link key={item.href} href={item.href}
            className={`nav-item ${pathname.startsWith(item.href) ? "active" : ""}`}>
            <span style={{ fontSize: 15 }}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </>
    );
  }

  return (
    <div>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>🍽️ RestoBill</h1>
          <p>Restaurant POS</p>
        </div>
        <nav className="sidebar-nav">
          <NavSection title="Operations" items={NAV_MAIN} />
          <NavSection title="Management" items={NAV_MANAGE} />
          <NavSection title="Analytics" items={NAV_REPORTS} />
          <NavSection title="Admin" items={NAV_ADMIN} />
        </nav>

        {/* User info + logout */}
        <div style={{ borderTop: "1px solid #1E2D42", padding: "12px 16px" }}>
          {user && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#CBD5E1" }}>{user.name}</div>
              <div style={{ fontSize: 10, color: "#3A4A62", fontWeight: 600 }}>{user.role}</div>
            </div>
          )}
          <button onClick={logout} style={{
            background: "#1E2D42", border: "none", width: "100%", cursor: "pointer",
            color: "#94A3B8", fontSize: 12, padding: "7px 0", borderRadius: 6,
            display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
            transition: "all 0.15s"
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
            {/* Global Search */}
            <div style={{ position: "relative" }}>
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="🔍 Search..." onBlur={() => setTimeout(() => setQuery(""), 200)}
                style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, width: 200, outline: "none" }} />
              {results.length > 0 && (
                <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "white", border: "1px solid #E2E8F0", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", width: 300, zIndex: 999 }}>
                  {results.map((r, i) => (
                    <div key={i} style={{ padding: "10px 14px", borderBottom: "1px solid #F1F5F9", cursor: "pointer" }}
                      onMouseDown={() => setQuery("")}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{r.label}</div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>{r.type} · {r.sub}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <span style={{ fontSize: 12, color: "#94A3B8" }}>
              {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
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
