"use client";
import { DeleteButton } from "@/components/DeleteButton";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useState, useEffect, useCallback, useRef } from "react";
import { showToast } from "@/components/Toast";

const KITCHENS = ["ALL", "MAIN", "GRILL", "BAR", "TANDOOR"];
const STATUS_FLOW: Record<string, string> = { PENDING: "PREPARING", PREPARING: "READY", READY: "SERVED" };
const S_COLOR  = { PENDING: "#FFF7ED", PREPARING: "#EFF6FF", READY: "#F0FDF4", SERVED: "#F8FAFC", CANCELLED: "#FEF2F2" };
const S_BORDER = { PENDING: "#FB923C", PREPARING: "#60A5FA", READY: "#4ADE80", SERVED: "#CBD5E1", CANCELLED: "#FCA5A5" };
const S_LABEL  = { PENDING: "#EA580C", PREPARING: "#2563EB", READY: "#16A34A", SERVED: "#64748B", CANCELLED: "#DC2626" };

type OItem = { id: string; quantity: number; price: number; notes?: string; kitchen?: string; menuItem: { name: string } };
type Order = {
  id: string; orderNumber: number; status: string; type: string; createdAt: string;
  isPriority: boolean; kotNote?: string; cancelRequestedBy?: string; cancelReason?: string;
  customerName?: string; table?: { id: string; number: string };
  items: OItem[];
  bill?: { paymentStatus: string; total: number };
};

export default function OrdersPage() {
  const { user, isOwner } = useCurrentUser();
  const isManager = isOwner || user?.role === "MANAGER";
  const [orders, setOrders]         = useState<Order[]>([]);
  const [filter, setFilter]         = useState<string>("ACTIVE");
  const [kitchenF, setKitchenF]     = useState("ALL");
  const [view, setView]             = useState<"KOT"|"LIST">("KOT");
  const [loading, setLoading]       = useState(true);
  const [tick, setTick]             = useState(0);
  const [tables, setTables]         = useState<{id:string;number:string}[]>([]);
  // Modals
  const [splitModal, setSplitModal] = useState<Order|null>(null);
  const [splitSel, setSplitSel]     = useState<string[]>([]);
  const [txModal, setTxModal]       = useState<Order|null>(null);   // transfer
  const [mergeModal, setMergeModal] = useState<Order|null>(null);
  const [noteModal, setNoteModal]   = useState<Order|null>(null);
  const [noteVal, setNoteVal]       = useState("");
  const [cancelModal, setCancelModal] = useState<Order|null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [busy, setBusy]             = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/orders");
    const data = await res.json();
    setOrders(data.orders ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ri = setInterval(load, 15000);
    const ti = setInterval(() => setTick(t => t + 1), 60000);
    return () => { clearInterval(ri); clearInterval(ti); };
  }, [load]);

  useEffect(() => {
    fetch("/api/tables").then(r => r.json()).then(d => setTables(d.tables ?? []));
  }, []);

  // ── Helpers ──
  function elapsed(createdAt: string) {
    const m = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    return m < 60 ? `${m}m` : `${Math.floor(m/60)}h ${m%60}m`;
  }
  function isLate(createdAt: string, status: string) {
    const m = (Date.now() - new Date(createdAt).getTime()) / 60000;
    return status === "PENDING" && m > 10 || status === "PREPARING" && m > 25;
  }

  async function api(url: string, method: string, body: object) {
    setBusy(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { showToast(data.error ?? "Error", "error"); return null; }
    return data;
  }

  async function updateStatus(o: Order, status: string) {
    const res = await api(`/api/orders/${o.id}`, "PUT", { status });
    if (res) { showToast(`#${o.orderNumber} → ${status}`); load(); }
  }
  async function togglePriority(o: Order) {
    const res = await api(`/api/orders/${o.id}`, "PUT", { isPriority: !o.isPriority });
    if (res) load();
  }
  async function setItemKitchen(o: Order, itemId: string, kitchen: string) {
    const res = await api(`/api/orders/${o.id}`, "PUT", { itemKitchens: [{ id: itemId, kitchen }] });
    if (res) load();
  }
  async function saveNote() {
    if (!noteModal) return;
    const res = await api(`/api/orders/${noteModal.id}`, "PUT", { kotNote: noteVal });
    if (res) { showToast("Note saved"); setNoteModal(null); load(); }
  }
  async function doSplit() {
    if (!splitModal || !splitSel.length) return;
    const res = await api(`/api/orders/${splitModal.id}/split`, "POST", { itemIds: splitSel });
    if (res) { showToast(`KOT split → Order #${res.newOrder.orderNumber}`); setSplitModal(null); setSplitSel([]); load(); }
  }
  async function doTransfer(tableId: string) {
    if (!txModal) return;
    const res = await api(`/api/orders/${txModal.id}/transfer`, "PUT", { tableId });
    if (res) { showToast("Table transferred"); setTxModal(null); load(); }
  }
  async function doMerge(targetId: string) {
    if (!mergeModal) return;
    const res = await api(`/api/orders/${mergeModal.id}/transfer`, "PUT", { mergeIntoOrderId: targetId });
    if (res) { showToast("KOTs merged"); setMergeModal(null); load(); }
  }
  async function requestCancel(o: Order) {
    if (!cancelReason.trim()) return;
    const res = await api(`/api/orders/${o.id}`, "PUT", { cancelRequest: cancelReason });
    if (res) { showToast("Cancel request sent to manager"); setCancelModal(null); setCancelReason(""); load(); }
  }
  async function approveCancel(o: Order) {
    const res = await api(`/api/orders/${o.id}`, "PUT", { status: "CANCELLED", cancelApprove: true });
    if (res) { showToast(`#${o.orderNumber} cancelled`); load(); }
  }

  function printKOT(o: Order) {
    const w = window.open("", "_blank", "width=320,height=520");
    if (!w) return;
    w.document.write(`<html><head><title>KOT #${o.orderNumber}</title>
<style>body{font-family:monospace;font-size:13px;padding:12px;max-width:280px}
h2{text-align:center;margin:0 0 2px;font-size:15px}
p{text-align:center;margin:2px 0;font-size:11px}
hr{border:none;border-top:1px dashed #000;margin:6px 0}
.row{display:flex;justify-content:space-between;margin:3px 0}
.note{font-size:10px;color:#555;margin:-1px 0 3px 0}
.kt{font-size:9px;background:#eee;padding:1px 4px;border-radius:3px}
.pri{font-size:10px;font-weight:700;border:1px solid #000;padding:1px 6px;display:inline-block}
</style></head><body>
<h2>KITCHEN ORDER</h2>
${o.isPriority ? '<p><span class="pri">★ PRIORITY</span></p>' : ""}
<p><b>${o.table ? "Table " + o.table.number : o.type}</b></p>
<p>KOT #${o.orderNumber}</p>
<p>${new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</p>
<hr/>
${o.items.map(i=>`<div class="row"><span>${i.menuItem.name}${i.kitchen?` <span class="kt">${i.kitchen}</span>`:""}</span><span><b>×${i.quantity}</b></span></div>${i.notes?`<div class="note">Note: ${i.notes}</div>`:""}`).join("")}
<hr/>
${o.kotNote ? `<p>🗒 ${o.kotNote}</p><hr/>` : ""}
<p style="font-size:10px">** KOT **</p>
</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  // ── Filters ──
  const active = orders.filter(o => ["PENDING","PREPARING","READY"].includes(o.status));
  let displayed = filter === "ACTIVE" ? active : filter === "PRIORITY"
    ? orders.filter(o => o.isPriority && ["PENDING","PREPARING","READY"].includes(o.status))
    : filter === "CANCEL_REQ"
    ? orders.filter(o => o.cancelRequestedBy)
    : ["PENDING","PREPARING","READY","SERVED","CANCELLED"].includes(filter)
    ? orders.filter(o => o.status === filter)
    : orders;

  if (kitchenF !== "ALL") {
    displayed = displayed.filter(o => o.items.some(i => i.kitchen === kitchenF));
  }

  const cancelReqs = orders.filter(o => o.cancelRequestedBy).length;
  void tick; // used for re-render

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16, flexWrap:"wrap", gap:8 }}>
        <div>
          <h2 style={{ margin:0, fontSize:20, fontWeight:800 }}>Smart KOT</h2>
          <p style={{ margin:"2px 0 0", fontSize:13, color:"#64748B" }}>
            {active.length} active{cancelReqs > 0 ? ` · ` : ""}
            {cancelReqs > 0 && <span style={{ color:"#DC2626", fontWeight:700 }}>{cancelReqs} cancel request{cancelReqs>1?"s":""}</span>}
          </p>
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          <button className={`btn btn-sm ${view==="KOT"?"btn-primary":"btn-ghost"}`} onClick={() => setView("KOT")}>🍳 KOT</button>
          <button className={`btn btn-sm ${view==="LIST"?"btn-primary":"btn-ghost"}`} onClick={() => setView("LIST")}>📋 List</button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
        {[["ACTIVE","Active"],["PENDING","Pending"],["PREPARING","Preparing"],["READY","Ready"],["PRIORITY","⭐ Priority"],["CANCEL_REQ",`🚫 Cancel${cancelReqs>0?` (${cancelReqs})`:""}]`],["ALL","All"]].map(([val,label]) => (
          <button key={val} className={`btn btn-sm ${filter===val?"btn-primary":"btn-ghost"}`}
            onClick={() => setFilter(val)}
            style={val==="CANCEL_REQ" && cancelReqs>0 ? { borderColor:"#DC2626", color:"#DC2626" } : {}}>
            {label}
          </button>
        ))}
      </div>

      {/* Kitchen routing filter */}
      <div style={{ display:"flex", gap:6, marginBottom:16, alignItems:"center" }}>
        <span style={{ fontSize:11, color:"#64748B", fontWeight:600, textTransform:"uppercase" }}>Kitchen:</span>
        {KITCHENS.map(k => (
          <button key={k} className={`btn btn-sm ${kitchenF===k?"btn-primary":"btn-ghost"}`}
            onClick={() => setKitchenF(k)} style={{ fontSize:11 }}>{k}</button>
        ))}
      </div>

      {/* Empty state */}
      {!loading && displayed.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 0", color:"#94A3B8" }}>
          <div style={{ fontSize:40, marginBottom:10 }}>🍳</div>
          <p style={{ fontSize:15, fontWeight:600, margin:0 }}>No orders</p>
          <p style={{ fontSize:13, margin:"4px 0 0" }}>Orders appear here when placed from Tables page</p>
        </div>
      ) : view === "KOT" ? (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))", gap:12 }}>
          {loading ? [1,2,3].map(i=><div key={i} className="skeleton" style={{height:220}}/>)
          : displayed.map(o => {
            const late = isLate(o.createdAt, o.status);
            const nextStatus = STATUS_FLOW[o.status];
            const bg   = (S_COLOR as Record<string,string>)[o.status]   ?? "#fff";
            const bdr  = (S_BORDER as Record<string,string>)[o.status]  ?? "#E2E8F0";
            const lbl  = (S_LABEL as Record<string,string>)[o.status]   ?? "#64748B";
            return (
              <div key={o.id} style={{
                background: bg,
                border: `2px solid ${o.isPriority ? "#E8721C" : bdr}`,
                borderRadius: 12, overflow:"hidden",
                boxShadow: o.isPriority ? "0 0 0 3px rgba(232,114,28,0.2)"
                  : late ? "0 0 0 3px rgba(220,38,38,0.2)" : "none",
              }}>
                {/* Card header */}
                <div style={{ padding:"10px 14px", background:"rgba(0,0,0,0.04)", borderBottom:`1px solid ${bdr}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      {o.isPriority && <span style={{ fontSize:12, background:"#E8721C", color:"#fff", borderRadius:4, padding:"1px 5px", fontWeight:700 }}>★ PRIORITY</span>}
                      <span style={{ fontWeight:800, fontSize:15 }}>
                        {o.table ? `Table ${o.table.number}` : o.type}
                      </span>
                    </div>
                    <span style={{ fontSize:11, color: late?"#DC2626":"#64748B", fontWeight: late?700:400 }}>
                      ⏱ {elapsed(o.createdAt)}
                    </span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                    <span style={{ fontSize:12, color:"#64748B" }}>#{o.orderNumber}</span>
                    <span style={{ fontSize:11, fontWeight:700, color: lbl, textTransform:"uppercase", letterSpacing:.5 }}>{o.status}</span>
                  </div>
                  {/* Cancel request alert */}
                  {o.cancelRequestedBy && (
                    <div style={{ marginTop:6, background:"rgba(220,38,38,0.1)", border:"1px solid #FCA5A5", borderRadius:6, padding:"4px 8px", fontSize:11, color:"#DC2626" }}>
                      🚫 Cancel requested: {o.cancelReason}
                    </div>
                  )}
                  {/* KOT note */}
                  {o.kotNote && (
                    <div style={{ marginTop:5, fontSize:11, color:"#64748B", background:"rgba(0,0,0,0.04)", borderRadius:5, padding:"3px 6px" }}>
                      🗒 {o.kotNote}
                    </div>
                  )}
                </div>

                {/* Items */}
                <div style={{ padding:"8px 14px", maxHeight:160, overflowY:"auto" }}>
                  {o.items.map(item => (
                    <div key={item.id} style={{ padding:"4px 0", borderBottom:"1px dashed rgba(0,0,0,0.07)" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:13 }}>
                        <span style={{ flex:1 }}>{item.menuItem.name}</span>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <select value={item.kitchen ?? ""} onChange={e => setItemKitchen(o, item.id, e.target.value)}
                            style={{ fontSize:10, padding:"1px 4px", borderRadius:4, border:"1px solid #CBD5E1", background:"#fff", color:"#64748B" }}>
                            <option value="">Kitchen</option>
                            {KITCHENS.slice(1).map(k=><option key={k} value={k}>{k}</option>)}
                          </select>
                          <span style={{ fontWeight:700, minWidth:24, textAlign:"right" }}>×{item.quantity}</span>
                        </div>
                      </div>
                      {item.notes && <div style={{ fontSize:10, color:"#94A3B8", marginTop:1 }}>📝 {item.notes}</div>}
                    </div>
                  ))}
                </div>

                {/* Actions row 1 */}
                <div style={{ padding:"8px 14px 4px", display:"flex", gap:5 }}>
                  <button className="btn btn-ghost btn-sm" style={{ flex:1, justifyContent:"center", fontSize:11 }}
                    onClick={() => printKOT(o)} title="Reprint KOT">🖨️ Print</button>
                  <button className="btn btn-ghost btn-sm" style={{ flex:1, justifyContent:"center", fontSize:11 }}
                    onClick={() => { setNoteModal(o); setNoteVal(o.kotNote ?? ""); setTimeout(()=>noteRef.current?.focus(),50); }}
                    title="Add note">🗒 Note</button>
                  <button className="btn btn-ghost btn-sm" style={{ flex:1, justifyContent:"center", fontSize:11,
                    color: o.isPriority ? "#E8721C" : undefined, fontWeight: o.isPriority ? 700 : undefined }}
                    onClick={() => togglePriority(o)} title="Toggle priority">
                    {o.isPriority ? "★ High" : "☆ Low"}
                  </button>
                </div>

                {/* Actions row 2 */}
                <div style={{ padding:"4px 14px 10px", display:"flex", gap:5 }}>
                  {["PENDING","PREPARING"].includes(o.status) && (
                    <>
                      <button className="btn btn-ghost btn-sm" style={{ flex:1, justifyContent:"center", fontSize:11 }}
                        onClick={() => { setSplitModal(o); setSplitSel([]); }} title="Split KOT">✂️ Split</button>
                      <button className="btn btn-ghost btn-sm" style={{ flex:1, justifyContent:"center", fontSize:11 }}
                        onClick={() => setTxModal(o)} title="Transfer table">⇄ Table</button>
                      <button className="btn btn-ghost btn-sm" style={{ flex:1, justifyContent:"center", fontSize:11 }}
                        onClick={() => setMergeModal(o)} title="Merge KOT">⊕ Merge</button>
                    </>
                  )}
                  {nextStatus && (
                    <button className="btn btn-primary btn-sm" style={{ flex:2, justifyContent:"center", fontSize:11 }}
                      onClick={() => updateStatus(o, nextStatus)}>
                      → {nextStatus}
                    </button>
                  )}
                </div>

                {/* Cancel controls */}
                <div style={{ padding:"0 14px 10px", display:"flex", gap:5 }}>
                  {o.cancelRequestedBy && isManager && (
                    <button className="btn btn-sm" style={{ flex:1, justifyContent:"center", fontSize:11, background:"#DC2626", color:"#fff", border:"none" }}
                      onClick={() => approveCancel(o)} disabled={busy}>
                      Approve Cancel
                    </button>
                  )}
                  {!o.cancelRequestedBy && !["SERVED","CANCELLED"].includes(o.status) && (
                    isManager ? (
                      <button className="btn btn-ghost btn-sm" style={{ flex:1, justifyContent:"center", fontSize:11, color:"#DC2626" }}
                        onClick={() => updateStatus(o, "CANCELLED")}>
                        🚫 Cancel
                      </button>
                    ) : (
                      <button className="btn btn-ghost btn-sm" style={{ flex:1, justifyContent:"center", fontSize:11, color:"#DC2626" }}
                        onClick={() => setCancelModal(o)}>
                        🚫 Request Cancel
                      </button>
                    )
                  )}
                  {isOwner && ["SERVED","CANCELLED"].includes(o.status) && (
                    <DeleteButton url={`/api/orders/${o.id}`} onDeleted={load} confirmMsg="Delete order + bill?" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View - unchanged */
        <div className="card" style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:"1px solid #E2E8F0" }}>
                {["#","Table/Type","Items","Status","Time","Priority","Actions"].map(h=>(
                  <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map(o=>{
                const nextStatus = STATUS_FLOW[o.status];
                return (
                  <tr key={o.id} style={{ borderBottom:"1px solid #F1F5F9" }}>
                    <td style={{ padding:"12px 14px", fontWeight:700 }}>#{o.orderNumber}</td>
                    <td style={{ padding:"12px 14px" }}>{o.table?`Table ${o.table.number}`:o.type}</td>
                    <td style={{ padding:"12px 14px", color:"#64748B" }}>{o.items.length} items</td>
                    <td style={{ padding:"12px 14px" }}><span className={`badge badge-${o.status.toLowerCase()}`}>{o.status}</span></td>
                    <td style={{ padding:"12px 14px", color:"#64748B", fontSize:12 }}>{elapsed(o.createdAt)}</td>
                    <td style={{ padding:"12px 14px" }}>{o.isPriority?<span style={{color:"#E8721C",fontWeight:700}}>★</span>:"—"}</td>
                    <td style={{ padding:"12px 14px" }}>
                      <div style={{ display:"flex", gap:5 }}>
                        {nextStatus && <button className="btn btn-ghost btn-sm" onClick={()=>updateStatus(o,nextStatus)}>→{nextStatus}</button>}
                        <button className="btn btn-ghost btn-sm" onClick={()=>printKOT(o)}>🖨️</button>
                        {isOwner&&["SERVED","CANCELLED"].includes(o.status)&&<DeleteButton url={`/api/orders/${o.id}`} onDeleted={load} confirmMsg="Delete?"/>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modals ── */}
      {/* Note Modal */}
      {noteModal && (
        <Modal title={`Note — Order #${noteModal.orderNumber}`} onClose={() => setNoteModal(null)}>
          <textarea ref={noteRef} value={noteVal} onChange={e=>setNoteVal(e.target.value)}
            placeholder="e.g. Less spicy, no onions…" rows={3}
            style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:"1px solid #CBD5E1", fontSize:13, resize:"vertical", boxSizing:"border-box" }} />
          <div style={{ display:"flex", gap:8, marginTop:10 }}>
            <button className="btn btn-primary" onClick={saveNote} disabled={busy} style={{ flex:1 }}>Save Note</button>
            <button className="btn btn-ghost" onClick={() => setNoteModal(null)} style={{ flex:1 }}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* Split Modal */}
      {splitModal && (
        <Modal title={`Split KOT — #${splitModal.orderNumber}`} onClose={()=>{setSplitModal(null);setSplitSel([])}}>
          <p style={{ fontSize:13, color:"#64748B", margin:"0 0 10px" }}>Select items to move to a NEW KOT:</p>
          {splitModal.items.map(item=>(
            <label key={item.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 0", borderBottom:"1px dashed #E2E8F0", cursor:"pointer", fontSize:13 }}>
              <input type="checkbox" checked={splitSel.includes(item.id)}
                onChange={e => setSplitSel(e.target.checked ? [...splitSel,item.id] : splitSel.filter(x=>x!==item.id))}
                style={{ width:16, height:16 }} />
              <span style={{ flex:1 }}>{item.menuItem.name}</span>
              <span style={{ fontWeight:700 }}>×{item.quantity}</span>
            </label>
          ))}
          <div style={{ display:"flex", gap:8, marginTop:12 }}>
            <button className="btn btn-primary" onClick={doSplit} disabled={busy||!splitSel.length} style={{ flex:1 }}>
              Split {splitSel.length>0?`(${splitSel.length} items)`:""}
            </button>
            <button className="btn btn-ghost" onClick={()=>{setSplitModal(null);setSplitSel([])}} style={{ flex:1 }}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* Table Transfer Modal */}
      {txModal && (
        <Modal title={`Transfer Table — #${txModal.orderNumber}`} onClose={()=>setTxModal(null)}>
          <p style={{ fontSize:13, color:"#64748B", margin:"0 0 10px" }}>Select new table:</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(80px,1fr))", gap:8 }}>
            {tables.filter(t=>t.id!==txModal.table?.id).map(t=>(
              <button key={t.id} className="btn btn-ghost" onClick={()=>doTransfer(t.id)} disabled={busy}
                style={{ justifyContent:"center", fontWeight:700 }}>
                Table {t.number}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Merge Modal */}
      {mergeModal && (
        <Modal title={`Merge KOT — #${mergeModal.orderNumber}`} onClose={()=>setMergeModal(null)}>
          <p style={{ fontSize:13, color:"#64748B", margin:"0 0 10px" }}>Merge ALL items from this KOT into:</p>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {orders.filter(o=>o.id!==mergeModal.id&&["PENDING","PREPARING"].includes(o.status)).map(o=>(
              <button key={o.id} className="btn btn-ghost" onClick={()=>doMerge(o.id)} disabled={busy}
                style={{ justifyContent:"flex-start", gap:10, fontSize:13 }}>
                <span style={{ fontWeight:700 }}>#{o.orderNumber}</span>
                <span>{o.table?`Table ${o.table.number}`:o.type}</span>
                <span style={{ color:"#64748B" }}>({o.items.length} items)</span>
              </button>
            ))}
            {orders.filter(o=>o.id!==mergeModal.id&&["PENDING","PREPARING"].includes(o.status)).length===0&&(
              <p style={{ color:"#94A3B8", fontSize:13, textAlign:"center", padding:"20px 0" }}>No other active orders</p>
            )}
          </div>
        </Modal>
      )}

      {/* Cancel Request Modal */}
      {cancelModal && (
        <Modal title={`Request Cancel — #${cancelModal.orderNumber}`} onClose={()=>{setCancelModal(null);setCancelReason("")}}>
          <p style={{ fontSize:13, color:"#64748B", margin:"0 0 10px" }}>Manager approval required. Provide reason:</p>
          <input value={cancelReason} onChange={e=>setCancelReason(e.target.value)}
            placeholder="Reason for cancellation…"
            style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:"1px solid #CBD5E1", fontSize:13, boxSizing:"border-box" }} />
          <div style={{ display:"flex", gap:8, marginTop:10 }}>
            <button className="btn btn-sm" style={{ flex:1, background:"#DC2626", color:"#fff", border:"none" }}
              onClick={()=>requestCancel(cancelModal)} disabled={busy||!cancelReason.trim()}>
              Send Request
            </button>
            <button className="btn btn-ghost btn-sm" onClick={()=>{setCancelModal(null);setCancelReason("")}} style={{ flex:1 }}>Back</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
      onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:14, padding:24, width:"100%", maxWidth:420, maxHeight:"80vh", overflowY:"auto" }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <h3 style={{ margin:0, fontSize:15, fontWeight:700 }}>{title}</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:18, cursor:"pointer", color:"#64748B", lineHeight:1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
