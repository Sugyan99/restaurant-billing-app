"use client";
import { useState, useEffect, useCallback } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { showToast } from "@/components/Toast";

type User = { id: string; name: string; role: string };
type AttRecord = {
  id: string; userId: string; clockIn: string; clockOut: string | null;
  breakMins: number; note: string | null; date: string;
  user: { id: string; name: string; role: string };
};

const ROLE_COLORS: Record<string, string> = {
  OWNER: "#7C3AED", MANAGER: "#2563EB", CASHIER: "#0891B2", KITCHEN: "#D97706",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}
function workedH(clockIn: string, clockOut: string | null, breakMins: number) {
  if (!clockOut) return null;
  const mins = Math.floor((new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 60000);
  const net = Math.max(0, mins - breakMins);
  const h = Math.floor(net / 60); const m = net % 60;
  return `${h}h ${m}m`;
}

export default function AttendancePage() {
  const { user, isManager } = useCurrentUser();
  const [records, setRecords]   = useState<AttRecord[]>([]);
  const [users, setUsers]       = useState<User[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<"today"|"month">("today");
  const [month, setMonth]       = useState(() => new Date().toISOString().slice(0,7));
  const [clockingIn, setClockin] = useState<string|null>(null);
  const [clockingOut, setClockout] = useState<AttRecord|null>(null);
  const [breakMins, setBreakMins] = useState(0);
  const [note, setNote]          = useState("");
  const [busy, setBusy]          = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const url = tab === "today"
      ? `/api/attendance?date=${new Date().toISOString().split("T")[0]}`
      : `/api/attendance?month=${month}`;
    const res = await fetch(url);
    const d = await res.json();
    setRecords(d.records ?? []);
    setUsers(d.users ?? []);
    setLoading(false);
  }, [tab, month]);

  useEffect(() => { load(); }, [load]);

  const clockedInMap = new Map(
    records.filter(r => !r.clockOut).map(r => [r.userId, r])
  );

  async function clockIn(userId: string) {
    setBusy(true);
    const res = await fetch("/api/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, note }) });
    const d = await res.json();
    if (!res.ok) { showToast(d.error ?? "Error", "error"); }
    else { showToast("✅ Clocked in", "success"); setNote(""); setClockin(null); load(); }
    setBusy(false);
  }

  async function clockOut(rec: AttRecord) {
    setBusy(true);
    const res = await fetch("/api/attendance", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attendanceId: rec.id, breakMins, note }) });
    const d = await res.json();
    if (!res.ok) { showToast(d.error ?? "Error", "error"); }
    else { showToast(`✅ Clocked out — ${d.workedHours}h worked`, "success"); setBreakMins(0); setNote(""); setClockout(null); load(); }
    setBusy(false);
  }

  const TD: React.CSSProperties = { padding: "10px 12px", fontSize: 13, borderBottom: "1px solid #F1F5F9" };
  const TH: React.CSSProperties = { ...TD, fontWeight: 700, fontSize: 11, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.4, background: "#F8FAFC" };

  const totalWorkedToday = records.filter(r => r.clockOut)
    .reduce((s, r) => {
      const mins = Math.floor((new Date(r.clockOut!).getTime() - new Date(r.clockIn).getTime()) / 60000);
      return s + Math.max(0, mins - r.breakMins);
    }, 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>👥 Staff Attendance</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>
            {tab === "today" ? `Today · ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}` : `Month: ${month}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className={`btn btn-sm ${tab === "today" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("today")}>Today</button>
          <button className={`btn btn-sm ${tab === "month" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("month")}>Monthly</button>
          {tab === "month" && <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input input-sm" style={{ width: 150 }} />}
          <button className="btn btn-ghost btn-sm" onClick={load}>🔄</button>
        </div>
      </div>

      {/* Today summary cards */}
      {tab === "today" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Present", value: records.length, color: "#22C55E" },
            { label: "Clocked Out", value: records.filter(r => r.clockOut).length, color: "#3B82F6" },
            { label: "Still In", value: records.filter(r => !r.clockOut).length, color: "#F59E0B" },
            { label: "Total Hours", value: `${Math.floor(totalWorkedToday/60)}h ${totalWorkedToday%60}m`, color: "#8B5CF6" },
          ].map(c => (
            <div key={c.label} className="card" style={{ padding: "14px 16px", borderLeft: `3px solid ${c.color}` }}>
              <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Today view: Staff grid */}
      {tab === "today" && isManager && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700 }}>Quick Clock In/Out</h3>
          {loading ? <div style={{ color: "#94A3B8", fontSize: 13 }}>Loading...</div> : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
              {users.map(u => {
                const active = clockedInMap.get(u.id);
                return (
                  <div key={u.id} style={{ border: `1px solid ${active ? "#86EFAC" : "#E2E8F0"}`, borderRadius: 10, padding: "12px 14px", background: active ? "#F0FDF4" : "#FAFAFA", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: active ? "#22C55E" : "#CBD5E1", flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: ROLE_COLORS[u.role] ?? "#64748B", fontWeight: 600 }}>{u.role}</div>
                      </div>
                    </div>
                    {active && (
                      <div style={{ fontSize: 11, color: "#64748B" }}>In since {fmt(active.clockIn)}</div>
                    )}
                    {active ? (
                      <button className="btn btn-sm" style={{ background: "#EF4444", color: "#fff", fontSize: 11 }}
                        onClick={() => { setClockout(active); setBreakMins(0); setNote(""); }}
                        disabled={busy}>Clock Out</button>
                    ) : (
                      <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }}
                        onClick={() => { setClockin(u.id); setNote(""); }}
                        disabled={busy}>Clock In</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Records table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #F1F5F9", fontWeight: 700, fontSize: 14 }}>
          Attendance Records {records.length > 0 && <span style={{ color: "#94A3B8", fontWeight: 400 }}>({records.length})</span>}
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Loading...</div>
        ) : records.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>No records found</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {tab === "month" && <th style={TH}>Date</th>}
                  <th style={TH}>Staff</th>
                  <th style={TH}>Role</th>
                  <th style={TH}>Clock In</th>
                  <th style={TH}>Clock Out</th>
                  <th style={TH}>Break</th>
                  <th style={TH}>Worked</th>
                  <th style={TH}>Note</th>
                  <th style={TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} style={{ background: r.clockOut ? "#fff" : "#FFFBEB" }}>
                    {tab === "month" && <td style={TD}>{fmtDate(r.date)}</td>}
                    <td style={{ ...TD, fontWeight: 600 }}>{r.user.name}</td>
                    <td style={{ ...TD, color: ROLE_COLORS[r.user.role] ?? "#64748B", fontWeight: 600, fontSize: 11 }}>{r.user.role}</td>
                    <td style={TD}>{fmt(r.clockIn)}</td>
                    <td style={TD}>{r.clockOut ? fmt(r.clockOut) : <span style={{ color: "#F59E0B" }}>—</span>}</td>
                    <td style={TD}>{r.breakMins > 0 ? `${r.breakMins}m` : "—"}</td>
                    <td style={{ ...TD, fontWeight: 600, color: r.clockOut ? "#16A34A" : "#64748B" }}>{workedH(r.clockIn, r.clockOut, r.breakMins) ?? "In progress"}</td>
                    <td style={{ ...TD, color: "#64748B", fontSize: 12 }}>{r.note ?? "—"}</td>
                    <td style={TD}>
                      <span style={{ padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: r.clockOut ? "#DCFCE7" : "#FEF3C7", color: r.clockOut ? "#16A34A" : "#D97706" }}>
                        {r.clockOut ? "DONE" : "IN"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Clock In Modal */}
      {clockingIn && (
        <div style={{ position: "fixed", inset: 0, background: "#00000066", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: 360, padding: 24 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>Clock In — {users.find(u => u.id === clockingIn)?.name}</h3>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 4 }}>Note (optional)</label>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Shift note..." className="input" style={{ width: "100%", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => clockIn(clockingIn)} disabled={busy}>✅ Clock In</button>
              <button className="btn btn-ghost" onClick={() => setClockin(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Clock Out Modal */}
      {clockingOut && (
        <div style={{ position: "fixed", inset: 0, background: "#00000066", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: 360, padding: 24 }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>Clock Out — {clockingOut.user.name}</h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748B" }}>Clocked in at {fmt(clockingOut.clockIn)}</p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 4 }}>Break Duration (minutes)</label>
              <input type="number" min={0} max={480} value={breakMins} onChange={e => setBreakMins(+e.target.value)} className="input" style={{ width: "100%", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 4 }}>Note (optional)</label>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="End of shift note..." className="input" style={{ width: "100%", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-sm" style={{ flex: 1, background: "#EF4444", color: "#fff" }} onClick={() => clockOut(clockingOut)} disabled={busy}>🔴 Clock Out</button>
              <button className="btn btn-ghost" onClick={() => setClockout(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
