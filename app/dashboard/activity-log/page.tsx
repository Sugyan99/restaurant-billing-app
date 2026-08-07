"use client";
import { useState, useEffect, useCallback } from "react";

type LogEntry = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  actor: string;
  actorRole: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
  source: "general" | "billing";
};

const ACTION_COLORS: Record<string, { bg: string; color: string; icon: string }> = {
  QR_ORDER_APPROVED:   { bg: "#DCFCE7", color: "#16A34A", icon: "✅" },
  ORDER_DELETED:       { bg: "#FEE2E2", color: "#DC2626", icon: "🗑️" },
  BILL_PAID:           { bg: "#DBEAFE", color: "#1D4ED8", icon: "💵" },
  BILL_VOIDED:         { bg: "#FEE2E2", color: "#DC2626", icon: "🚫" },
  BILL_REFUNDED:       { bg: "#EDE9FE", color: "#7C3AED", icon: "↩️" },
  BILL_SPLIT_PAID:     { bg: "#DBEAFE", color: "#1D4ED8", icon: "✂️" },
  BILL_CREATED:        { bg: "#FEF9C3", color: "#CA8A04", icon: "🧾" },
  DISCOUNT_APPROVED:   { bg: "#DCFCE7", color: "#16A34A", icon: "✔️" },
  DISCOUNT_REJECTED:   { bg: "#FEE2E2", color: "#DC2626", icon: "✖️" },
};

function actionBadge(action: string) {
  const cfg = ACTION_COLORS[action] ?? { bg: "#F1F5F9", color: "#475569", icon: "📋" };
  return (
    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
      {cfg.icon} {action.replace(/_/g, " ")}
    </span>
  );
}

function roleBadge(role: string) {
  const map: Record<string, string> = { OWNER: "#0F1623", MANAGER: "#7C3AED", CASHIER: "#1D4ED8", KITCHEN: "#EA580C" };
  return (
    <span style={{ background: map[role] ?? "#64748B", color: "white", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>
      {role}
    </span>
  );
}

export default function ActivityLogPage() {
  const [logs, setLogs]     = useState<LogEntry[]>([]);
  const [loading, setLoad]  = useState(true);
  const [date, setDate]     = useState("");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<LogEntry | null>(null);

  const load = useCallback(async () => {
    setLoad(true);
    const params = new URLSearchParams();
    if (date)   params.set("date",   date);
    if (search) params.set("search", search);
    const res  = await fetch(`/api/activity-log?${params}`);
    const data = await res.json();
    setLogs(data.logs ?? []);
    setLoad(false);
  }, [date, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Activity Log</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>Staff actions & billing events (last 7 days)</p>
        </div>
        <button onClick={load} style={{ background: "#F1F5F9", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
          🔄 Refresh
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="date" value={date} onChange={(e) => setDate(e.target.value)}
          style={{ border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none" }}
        />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search action / actor…"
          style={{ border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", minWidth: 200 }}
        />
        {(date || search) && (
          <button onClick={() => { setDate(""); setSearch(""); }}
            style={{ background: "#FEE2E2", color: "#DC2626", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            ✕ Clear
          </button>
        )}
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#94A3B8" }}>Loading…</div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#94A3B8" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
            <p>No activity found.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  {["Time", "Action", "Entity", "Actor", "Role", "Details"].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}
                    onClick={() => setDetail(log)}
                    style={{ borderBottom: "1px solid #F1F5F9", cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFC")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                    <td style={{ padding: "10px 14px", color: "#64748B", whiteSpace: "nowrap" }}>
                      {new Date(log.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td style={{ padding: "10px 14px" }}>{actionBadge(log.action)}</td>
                    <td style={{ padding: "10px 14px", color: "#475569" }}>
                      <div>{log.entity}</div>
                      <div style={{ fontSize: 11, color: "#94A3B8" }}>{log.entityId?.slice(-8)}</div>
                    </td>
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>{log.actor}</td>
                    <td style={{ padding: "10px 14px" }}>{roleBadge(log.actorRole)}</td>
                    <td style={{ padding: "10px 14px", color: "#64748B", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {log.meta ? Object.entries(log.meta).map(([k, v]) => `${k}: ${v}`).join(" | ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: "#94A3B8", textAlign: "right" }}>
        Showing {logs.length} entries
      </div>

      {/* Detail modal */}
      {detail && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDetail(null)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 className="modal-title" style={{ margin: 0 }}>Log Detail</h3>
              <button onClick={() => setDetail(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94A3B8" }}>✕</button>
            </div>
            <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748B" }}>Action</span>{actionBadge(detail.action)}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748B" }}>Time</span>
                <span>{new Date(detail.createdAt).toLocaleString("en-IN")}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748B" }}>Actor</span>
                <span style={{ fontWeight: 600 }}>{detail.actor} {roleBadge(detail.actorRole)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748B" }}>Entity</span>
                <span>{detail.entity}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748B" }}>Entity ID</span>
                <span style={{ fontFamily: "monospace", fontSize: 11 }}>{detail.entityId}</span>
              </div>
              {detail.meta && (
                <>
                  <hr style={{ border: "none", borderTop: "1px dashed #E2E8F0" }} />
                  <div style={{ color: "#64748B", fontWeight: 600, fontSize: 12 }}>Metadata</div>
                  {Object.entries(detail.meta).map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#94A3B8" }}>{k}</span>
                      <span>{String(v)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
