"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ToastContainer } from "@/components/Toast";
import { AIAssistant } from "@/components/AIAssistant";

const NAV = [
  { href: "/dashboard/tables", icon: "🪑", label: "Tables & Orders" },
  { href: "/dashboard/orders", icon: "📋", label: "All Orders" },
  { href: "/dashboard/bills", icon: "🧾", label: "Bills" },
  { href: "/dashboard/menu", icon: "🍽️", label: "Menu" },
  { href: "/dashboard/reports", icon: "📊", label: "Reports" },
  { href: "/dashboard/settings", icon: "⚙️", label: "Settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const currentPage = NAV.find((n) => pathname.startsWith(n.href));

  return (
    <div>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>🍽️ RestoBill</h1>
          <p>Billing System</p>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">Main</div>
          {NAV.slice(0, 3).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${pathname.startsWith(item.href) ? "active" : ""}`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
          <div className="nav-section">Management</div>
          {NAV.slice(3).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${pathname.startsWith(item.href) ? "active" : ""}`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <button
          onClick={logout}
          className="nav-item"
          style={{ background: "none", border: "none", width: "100%", cursor: "pointer", color: "#94A3B8", marginBottom: 12 }}
        >
          <span>🚪</span>
          <span>Logout</span>
        </button>
      </aside>

      {/* Main content */}
      <main className="main-content">
        <div className="topbar">
          <span className="topbar-title">{currentPage?.label ?? "Dashboard"}</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#64748B" }}>
              {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
        </div>
        <div className="page-body">{children}</div>
      </main>

      <ToastContainer />
      <AIAssistant />
    </div>
  );
}
