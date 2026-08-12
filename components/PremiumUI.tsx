"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Command, Moon, Search, Sun, X, Zap } from "lucide-react";

const COMMANDS = [
  { label: "Dashboard", href: "/dashboard/home", keywords: "home overview" },
  { label: "Tables & POS", href: "/dashboard/tables", keywords: "tables billing pos" },
  { label: "Kitchen / KOT", href: "/dashboard/orders", keywords: "orders kitchen kot" },
  { label: "Bills & Payments", href: "/dashboard/bills", keywords: "bills payments" },
  { label: "Menu & Import", href: "/dashboard/menu", keywords: "menu food import" },
  { label: "Inventory & Stock", href: "/dashboard/inventory", keywords: "inventory stock" },
  { label: "Customers & Loyalty", href: "/dashboard/customers", keywords: "customers loyalty" },
  { label: "Finance", href: "/dashboard/finance", keywords: "finance money" },
  { label: "Sales Reports", href: "/dashboard/reports", keywords: "reports sales analytics" },
  { label: "GST Report", href: "/dashboard/gst-report", keywords: "gst tax report" },
  { label: "Staff", href: "/dashboard/users", keywords: "staff users employees" },
  { label: "Settings & QR", href: "/dashboard/settings", keywords: "settings qr configuration" },
];

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = document.documentElement.dataset.theme;
    setDark(saved === "dark");
  }, []);

  function toggle() {
    const next = !dark;
    document.documentElement.dataset.theme = next ? "dark" : "light";
    document.cookie = `restobill-theme=${next ? "dark" : "light"};path=/;max-age=31536000;samesite=lax`;
    setDark(next);
  }

  return (
    <button className="ui-icon-button" onClick={toggle} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Dark mode"}>
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter(c => `${c.label} ${c.keywords}`.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowDown") { event.preventDefault(); setSelected(s => Math.min(s + 1, Math.max(0, results.length - 1))); }
      if (event.key === "ArrowUp") { event.preventDefault(); setSelected(s => Math.max(0, s - 1)); }
      if (event.key === "Enter" && results[selected]) {
        event.preventDefault(); router.push(results[selected].href); onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, results, router, selected]);

  if (!open) return null;

  return (
    <div className="command-overlay" role="presentation" onMouseDown={onClose}>
      <div className="command-dialog" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={e => e.stopPropagation()}>
        <div className="command-search">
          <Search size={18} />
          <input autoFocus value={query} onChange={e => { setQuery(e.target.value); setSelected(0); }} placeholder="Search pages and actions…" aria-label="Search commands" />
          <kbd>ESC</kbd>
          <button className="ui-icon-button ui-icon-button-small" onClick={onClose} aria-label="Close command palette"><X size={15} /></button>
        </div>
        <div className="command-list">
          {results.length === 0 ? <div className="command-empty">No matching pages</div> : results.map((item, index) => (
            <button key={item.href} className={`command-item ${index === selected ? "selected" : ""}`} onMouseEnter={() => setSelected(index)} onClick={() => { router.push(item.href); onClose(); }}>
              <span className="command-item-icon"><Zap size={15} /></span>
              <span><strong>{item.label}</strong><small>{item.keywords}</small></span>
              {index === selected && <kbd>↵</kbd>}
            </button>
          ))}
        </div>
        <div className="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>ESC</kbd> close</span></div>
      </div>
    </div>
  );
}

export function PremiumUI() {
  const pathname = usePathname();
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (!root.dataset.theme) root.dataset.theme = "light";
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      document.documentElement.style.setProperty("--route-key", pathname);
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return <CommandPalette open={palette} onClose={() => setPalette(false)} />;
}
