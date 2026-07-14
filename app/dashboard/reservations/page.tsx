"use client";
import { DeleteButton } from "@/components/DeleteButton";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useState, useEffect, useCallback } from "react";
import { showToast } from "@/components/Toast";

type Reservation = { id: string; customerName: string; customerPhone: string; partySize: number; date: string; status: string; notes?: string; table?: { number: string } };
type Table = { id: string; number: string; capacity: number; status: string };

const STATUS_COLORS: Record<string, string> = { CONFIRMED: "#2563EB", SEATED: "#16A34A", CANCELLED: "#DC2626", NO_SHOW: "#94A3B8" };

export default function ReservationsPage() {
  const { isOwner } = useCurrentUser();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ customerName: "", customerPhone: "", partySize: 2, date: new Date().toISOString().slice(0, 16), tableId: "", notes: "" });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const [r, t] = await Promise.all([fetch(`/api/reservations?date=${date}`), fetch("/api/tables")]);
    const [rd, td] = await Promise.all([r.json(), t.json()]);
    setReservations(rd.reservations ?? []);
    setTables(td.tables ?? []);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!form.customerName || !form.customerPhone) { showToast("Name and phone required", "error"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/reservations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast("Reservation confirmed!"); setShowModal(false); setForm({ customerName: "", customerPhone: "", partySize: 2, date: new Date().toISOString().slice(0, 16), tableId: "", notes: "" }); await load();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setLoading(false); }
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/reservations/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    showToast(`Marked as ${status}`); await load();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div><h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Reservations</h2><p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>{reservations.filter(r => r.status === "CONFIRMED").length} confirmed today</p></div>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} style={{ width: 160 }} />
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Reservation</button>
        </div>
      </div>

      {reservations.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
          <p style={{ fontWeight: 600 }}>No reservations for this date</p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ marginTop: 12 }}>+ Add Reservation</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {reservations.map(r => (
            <div key={r.id} className="card" style={{ padding: 16, borderLeft: `4px solid ${STATUS_COLORS[r.status] ?? "#E2E8F0"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{r.customerName} <span style={{ fontSize: 12, color: "#64748B" }}>📞 {r.customerPhone}</span></div>
                  <div style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
                    🕐 {new Date(r.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} &nbsp;|&nbsp; 👥 {r.partySize} guests {r.table ? `&nbsp;|&nbsp; 🪑 Table ${r.table.number}` : ""}
                  </div>
                  {r.notes && <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>📝 {r.notes}</div>}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: `${STATUS_COLORS[r.status]}15`, color: STATUS_COLORS[r.status] }}>{r.status}</span>
                  {r.status === "CONFIRMED" && <button className="btn btn-success btn-sm" onClick={() => updateStatus(r.id, "SEATED")}>Seat</button>}
                  {r.status === "CONFIRMED" && <button className="btn btn-danger btn-sm" onClick={() => updateStatus(r.id, "NO_SHOW")}>No Show</button>}
                  {r.status === "CONFIRMED" && <button className="btn btn-ghost btn-sm" onClick={() => updateStatus(r.id, "CANCELLED")}>Cancel</button>}
                  {isOwner && <DeleteButton url={`/api/reservations/${r.id}`} onDeleted={load} confirmMsg="Delete reservation?" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h3 className="modal-title">New Reservation</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group" style={{ gridColumn: "1/-1" }}><label className="form-label">Customer Name *</label><input className="form-input" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Phone *</label><input className="form-input" value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Party Size</label><input className="form-input" type="number" min="1" value={form.partySize} onChange={e => setForm({ ...form, partySize: parseInt(e.target.value) })} /></div>
              <div className="form-group" style={{ gridColumn: "1/-1" }}><label className="form-label">Date & Time *</label><input className="form-input" type="datetime-local" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
              <div className="form-group" style={{ gridColumn: "1/-1" }}><label className="form-label">Table (optional)</label>
                <select className="form-select" value={form.tableId} onChange={e => setForm({ ...form, tableId: e.target.value })}>
                  <option value="">Auto-assign</option>
                  {tables.filter(t => t.status === "FREE").map(t => <option key={t.id} value={t.id}>Table {t.number} (cap: {t.capacity})</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: "1/-1" }}><label className="form-label">Notes</label><input className="form-input" placeholder="Special requests..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={loading}>{loading ? "Saving..." : "Confirm Reservation"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
