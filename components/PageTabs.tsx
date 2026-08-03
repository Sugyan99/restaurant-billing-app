"use client";
import { useState } from "react";

type Tab = { id: string; label: string; icon?: string };

export function PageTabs({ tabs, children }: { tabs: Tab[]; children: (activeTab: string) => React.ReactNode }) {
  const [active, setActive] = useState(tabs[0].id);
  return (
    <div>
      <div style={{ display: "flex", borderBottom: "2px solid #F1F5F9", marginBottom: 24, gap: 0, overflowX: "auto" }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActive(tab.id)}
            style={{
              padding: "10px 22px", border: "none", background: "none", cursor: "pointer",
              fontWeight: active === tab.id ? 700 : 500,
              color: active === tab.id ? "#E8721C" : "#64748B",
              borderBottom: active === tab.id ? "2px solid #E8721C" : "2px solid transparent",
              marginBottom: -2, fontSize: 14, whiteSpace: "nowrap", transition: "all .15s",
              display: "flex", alignItems: "center", gap: 6,
            }}>
            {tab.icon && <span>{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>
      {children(active)}
    </div>
  );
}
