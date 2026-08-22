"use client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useState, useEffect, useCallback } from "react";
import { showToast } from "@/components/Toast";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";

type SplitEntry = { mode: "CASH" | "UPI" | "CARD" | "CREDIT"; amount: number };
type Bill = {
  id: string; billNumber: number; subtotal: number; cgst: number; sgst: number;
  discount: number; total: number; tip: number; roundOff: number;
  paidAmount: number; refundAmount: number; refundReason?: string; voidReason?: string;
  paymentMode: string | null; splitPayments: SplitEntry[] | null;
  paymentStatus: "PENDING" | "PAID" | "PARTIALLY_PAID";
  billStatus: "ACTIVE" | "HOLD" | "VOID" | "REFUNDED";
  discountApprovalStatus: "AUTO" | "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  order: {
    id: string; orderNumber: number; type: string; customerName?: string; customerPhone?: string;
    source?: string; kotNote?: string;
    table?: { number: string };
    customer?: { id: string; name: string; phone: string; totalVisits: number; totalSpent: number; loyaltyPoints: number } | null;
    createdBy?: { name: string; role: string };
    items: { quantity: number; price: number; notes?: string | null; menuItem: { name: string } }[];
  };
};

const MODES = ["CASH", "UPI", "CARD", "CREDIT"] as const;
type Mode = typeof MODES[number];
const modeIcon: Record<Mode, string> = { CASH: "💵", UPI: "📱", CARD: "💳", CREDIT: "📝" };

function statusBadge(bill: Bill) {
  if (bill.billStatus === "VOID") return <span style={{ background: "#FEE2E2", color: "#DC2626", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>VOID</span>;
  if (bill.billStatus === "HOLD") return <span style={{ background: "#FEF9C3", color: "#CA8A04", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>HOLD</span>;
  if (bill.billStatus === "REFUNDED") return <span style={{ background: "#EDE9FE", color: "#7C3AED", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>REFUNDED</span>;
  if (bill.discountApprovalStatus === "PENDING") return <span style={{ background: "#FFF7ED", color: "#EA580C", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>⏳ APPROVAL</span>;
  if (bill.paymentStatus === "PAID") return <span style={{ background: "#DCFCE7", color: "#16A34A", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>PAID</span>;
  if (bill.paymentStatus === "PARTIALLY_PAID") return <span style={{ background: "#DBEAFE", color: "#1D4ED8", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>PARTIAL</span>;
  return <span style={{ background: "#F1F5F9", color: "#475569", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>PENDING</span>;
}

function printBill(bill: Bill) {
  const w = window.open("", "_blank", "width=400,height=700");
  if (!w) return;
  const items = bill.order.items.map(i => `<div class="row"><span>${i.menuItem.name} x${i.quantity}</span><span>₹${(i.price * i.quantity).toFixed(2)}</span></div>`).join("");
  w.document.write(`<html><head><title>Bill #${bill.billNumber}</title>
  <style>body{font-family:monospace;font-size:13px;padding:16px;max-width:300px;margin:0 auto}h2{text-align:center;margin:0 0 4px;font-size:16px}p{text-align:center;margin:2px 0;font-size:11px}hr{border:none;border-top:1px dashed #000;margin:8px 0}.row{display:flex;justify-content:space-between;margin:3px 0}.total{font-weight:bold;font-size:14px}</style></head>
  <body><h2>🍽️ RestoBill</h2><p>${bill.order.table ? "Table " + bill.order.table.number : bill.order.type}</p>
  <p>Bill #${bill.billNumber} | ${new Date(bill.createdAt).toLocaleString("en-IN")}</p><hr>
  ${items}<hr>
  <div class="row"><span>Subtotal</span><span>₹${bill.subtotal.toFixed(2)}</span></div>
  ${bill.discount > 0 ? `<div class="row"><span>Discount</span><span>-₹${bill.discount.toFixed(2)}</span></div>` : ""}
  ${bill.cgst > 0 ? `<div class="row"><span>CGST</span><span>₹${bill.cgst.toFixed(2)}</span></div>` : ""}
  ${bill.sgst > 0 ? `<div class="row"><span>SGST</span><span>₹${bill.sgst.toFixed(2)}</span></div>` : ""}
  ${bill.tip > 0 ? `<div class="row"><span>Tip</span><span>₹${bill.tip.toFixed(2)}</span></div>` : ""}
  ${bill.roundOff !== 0 ? `<div class="row"><span>Round Off</span><span>${bill.roundOff >= 0 ? "+" : ""}₹${bill.roundOff.toFixed(2)}</span></div>` : ""}
  <hr><div class="row total"><span>TOTAL</span><span>₹${bill.total.toFixed(2)}</span></div>
  ${bill.paidAmount > 0 && bill.paidAmount < bill.total ? `<div class="row"><span>Paid</span><span>₹${bill.paidAmount.toFixed(2)}</span></div><div class="row"><span>Balance</span><span>₹${(bill.total - bill.paidAmount).toFixed(2)}</span></div>` : ""}
  <hr><p>${bill.paymentMode ?? ""}${bill.splitPayments ? "Split" : ""}</p>
  <p style="margin-top:12px">Thank you for dining with us!</p></body></html>`);
  w.document.close(); w.print();
}

export default function BillsPage() {
  const { isOwner, isManager } = useCurrentUser();
  const canApprove = isOwner || isManager;

  const [bills, setBills] = useState<Bill[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDate, setFilterDate] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Payment modal state
  const [payBill, setPayBill] = useState<Bill | null>(null);
  const [payMode, setPayMode] = useState<Mode>("CASH");
  const [tip, setTip] = useState("");
  const [roundOffAuto, setRoundOffAuto] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [splitPayments, setSplitPayments] = useState<{ mode: Mode; amount: string }[]>([
    { mode: "CASH", amount: "" }, { mode: "UPI", amount: "" },
  ]);
  const [partialMode, setPartialMode] = useState(false);
  const [partialAmount, setPartialAmount] = useState("");

  // Action modals
  const [voidBill, setVoidBill] = useState<Bill | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [refundBill, setRefundBill] = useState<Bill | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [detailBill, setDetailBill] = useState<Bill | null>(null);
  // Owner edit/delete
  const [editBill, setEditBill]         = useState<Bill | null>(null);
  const [editName, setEditName]         = useState("");
  const [editPhone, setEditPhone]       = useState("");
  const [editSaving, setEditSaving]     = useState(false);
  const [deleteBill, setDeleteBill]     = useState<Bill | null>(null);
  const [deleting, setDeleting]         = useState(false);

  const loadBills = useCallback(async () => {
    const url = filterDate ? `/api/bills?date=${filterDate}` : "/api/bills";
    const res = await fetch(url);
    const data = await res.json();
    setBills(data.bills ?? []);
  }, [filterDate]);

  useEffect(() => { loadBills(); }, [loadBills]);

  const filtered = bills.filter(b => {
    if (filterStatus !== "all") {
      if (filterStatus === "PENDING" && b.paymentStatus !== "PENDING") return false;
      if (filterStatus === "PAID" && b.paymentStatus !== "PAID") return false;
      if (filterStatus === "PARTIAL" && b.paymentStatus !== "PARTIALLY_PAID") return false;
      if (filterStatus === "HOLD" && b.billStatus !== "HOLD") return false;
      if (filterStatus === "VOID" && b.billStatus !== "VOID") return false;
      if (filterStatus === "REFUNDED" && b.billStatus !== "REFUNDED") return false;
      if (filterStatus === "APPROVAL" && b.discountApprovalStatus !== "PENDING") return false;
    }
    if (search) {
      const s = search.toLowerCase();
      return (
        String(b.billNumber).includes(s) ||
        String(b.order.orderNumber).includes(s) ||
        (b.order.customerName ?? "").toLowerCase().includes(s) ||
        (b.order.table?.number ?? "").includes(s)
      );
    }
    return true;
  });

  // Computed payment values
  const computeFinalTotal = (bill: Bill) => {
    const t = parseFloat(tip) || 0;
    let ro = 0;
    if (roundOffAuto) {
      const base = bill.total + t;
      ro = Math.round(base) - base;
    }
    return { t, ro, finalTotal: bill.total + t + (roundOffAuto ? (Math.round(bill.total + t) - (bill.total + t)) : 0) };
  };

  function openPayModal(bill: Bill) {
    setPayBill(bill); setTip(""); setRoundOffAuto(false);
    setSplitMode(false); setPartialMode(false); setPartialAmount("");
    setSplitPayments([{ mode: "CASH", amount: "" }, { mode: "UPI", amount: "" }]);
    setPayMode("CASH");
  }

  async function collectPayment() {
    if (!payBill) return;
    setLoading(true);
    try {
      const { t, ro, finalTotal } = computeFinalTotal(payBill);
      const paid = partialMode ? parseFloat(partialAmount) : undefined;

      if (splitMode) {
        const payments = splitPayments
          .filter(p => parseFloat(p.amount) > 0)
          .map(p => ({ mode: p.mode, amount: parseFloat(p.amount) }));
        if (payments.length < 2) { showToast("Enter amounts for at least 2 modes", "error"); setLoading(false); return; }
        const res = await fetch(`/api/bills/${payBill.id}/split`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payments, tip: t, roundOff: ro }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      } else {
        const res = await fetch(`/api/bills/${payBill.id}/pay`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentMode: payMode, tip: t, roundOff: ro, ...(paid ? { paidAmount: paid } : {}) }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      }
      showToast(partialMode ? `Partial payment of ₹${paid} recorded` : `Bill #${payBill.billNumber} paid!`);
      setPayBill(null); await loadBills();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Payment failed", "error");
    } finally { setLoading(false); }
  }

  async function toggleHold(bill: Bill) {
    const res = await fetch(`/api/bills/${bill.id}/hold`, { method: "POST" });
    if (!res.ok) { showToast((await res.json()).error, "error"); return; }
    const d = await res.json();
    showToast(d.billStatus === "HOLD" ? "Bill put on hold" : "Hold removed");
    await loadBills();
  }

  async function submitVoid() {
    if (!voidBill || !voidReason.trim()) { showToast("Enter void reason", "error"); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/bills/${voidBill.id}/void`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: voidReason }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast(`Bill #${voidBill.billNumber} voided`);
      setVoidBill(null); setVoidReason(""); await loadBills();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Void failed", "error");
    } finally { setLoading(false); }
  }

  async function submitRefund() {
    if (!refundBill || !refundReason.trim()) { showToast("Enter refund reason", "error"); return; }
    setLoading(true);
    try {
      const amt = refundAmount ? parseFloat(refundAmount) : undefined;
      const res = await fetch(`/api/bills/${refundBill.id}/refund`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: refundReason, ...(amt ? { amount: amt } : {}) }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast(`Refund processed for Bill #${refundBill.billNumber}`);
      setRefundBill(null); setRefundReason(""); setRefundAmount(""); await loadBills();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Refund failed", "error");
    } finally { setLoading(false); }
  }

  async function approveDiscount(bill: Bill, action: "APPROVE" | "REJECT") {
    const res = await fetch(`/api/bills/${bill.id}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) { showToast((await res.json()).error, "error"); return; }
    showToast(action === "APPROVE" ? "Discount approved" : "Discount rejected");
    await loadBills();
  }

  async function saveOrderEdit() {
    if (!editBill) return;
    setEditSaving(true);
    const res = await fetch(`/api/orders/${editBill.order.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerName: editName, customerPhone: editPhone }),
    });
    setEditSaving(false);
    if (!res.ok) { showToast((await res.json()).error ?? "Failed", "error"); return; }
    showToast("Order updated");
    setEditBill(null);
    await loadBills();
  }

  async function deleteOrder() {
    if (!deleteBill) return;
    setDeleting(true);
    const res = await fetch(`/api/orders/${deleteBill.order.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) { showToast((await res.json()).error ?? "Failed to delete", "error"); return; }
    showToast("Order deleted");
    setDeleteBill(null);
    setDetailBill(null);
    await loadBills();
  }

  const todayRevenue = bills.filter(b => b.paymentStatus === "PAID" && b.billStatus !== "REFUNDED").reduce((s, b) => s + b.total, 0);
  const pendingCount = bills.filter(b => b.paymentStatus === "PENDING" && b.billStatus === "ACTIVE" && b.discountApprovalStatus !== "PENDING").length;
  const approvalCount = bills.filter(b => b.discountApprovalStatus === "PENDING").length;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display:"flex", justifyContent:"space-between", alignItems:"center", mb:2, flexWrap:"wrap", gap:1 }}>
        <Typography variant="h5" sx={{ fontWeight:800, fontSize:{ xs:18, md:22 } }}>📋 Bill History</Typography>
        <Stack direction="row" sx={{ flexWrap:"wrap", gap:1 }}>
          <TextField type="date" size="small" value={filterDate} onChange={e => setFilterDate(e.target.value)} sx={{ width:{ xs:140, md:160 } }}/>
          <TextField size="small" placeholder="Search bill#, table, customer…" value={search} onChange={e => setSearch(e.target.value)} sx={{ width:{ xs:"100%", sm:220 } }}/>
          <Select size="small" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} sx={{ fontSize:13, minWidth:130 }}>
            {[["all","All Bills"],["PENDING","Pending"],["PAID","Paid"],["PARTIAL","Partial"],["HOLD","On Hold"],["VOID","Voided"],["REFUNDED","Refunded"],["APPROVAL","Awaiting Approval"]].map(([v,l]) => (
              <MenuItem key={v} value={v} sx={{ fontSize:13 }}>{l}</MenuItem>
            ))}
          </Select>
          {filterDate && <Button size="small" variant="outlined" onClick={() => setFilterDate("")}>✕ Clear</Button>}
        </Stack>
      </Box>

      {/* Stats */}
      <Grid container spacing={1.5} sx={{ mb:2.5 }}>
        {[
          { label:"Today's Revenue", value:`₹${todayRevenue.toFixed(0)}`, color:"#E8721C", bg:"#FFF7ED" },
          { label:"Total Bills",      value:bills.length,                   color:"#1E293B", bg:"#F8FAFC" },
          { label:"Pending",          value:pendingCount,                   color:"#CA8A04", bg:"#FEFCE8" },
          { label:"Paid",             value:bills.filter(b=>b.paymentStatus==="PAID").length, color:"#16A34A", bg:"#F0FDF4" },
          ...(approvalCount > 0 ? [{ label:"Need Approval", value:approvalCount, color:"#DC2626", bg:"#FEF2F2" }] : []),
        ].map(s => (
          <Grid key={s.label} size={{ xs:6, sm:4, md:"auto" }}>
            <Card elevation={0} sx={{ bgcolor:s.bg, border:`1px solid ${s.color}22`, minWidth:130 }}>
              <CardContent sx={{ p:"12px 16px!important" }}>
                <Typography sx={{ fontSize:11, color:"text.secondary", fontWeight:600, mb:.5 }}>{s.label}</Typography>
                <Typography sx={{ fontSize:20, fontWeight:800, color:s.color }}>{s.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Table */}
      <Card elevation={0} sx={{ overflow:"hidden" }}>
        <Box sx={{ overflowX:"auto" }}>
          {filtered.length === 0
            ? <Typography sx={{ textAlign:"center", py:6, color:"text.secondary" }}>No bills found. Generate bills from the Tables page.</Typography>
            : <Table size="small">
                <TableHead sx={{ bgcolor:"#F8FAFC" }}>
                  <TableRow sx={{ "& th":{ fontSize:11, fontWeight:700, color:"text.secondary", textTransform:"uppercase", whiteSpace:"nowrap" } }}>
                    {["Bill #","Order #","Table/Type","Total","Discount","Status","Time","Actions"].map(h => <TableCell key={h}>{h}</TableCell>)}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map(bill => (
                    <TableRow key={bill.id} hover sx={{ cursor:"pointer", opacity:bill.billStatus==="VOID"?.6:1 }} onClick={() => setDetailBill(bill)}>
                      <TableCell><Typography sx={{ fontWeight:700 }}>#{bill.billNumber}</Typography></TableCell>
                      <TableCell sx={{ color:"text.secondary" }}>#{bill.order.orderNumber}</TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize:13 }}>{bill.order.table ? `Table ${bill.order.table.number}` : bill.order.type}</Typography>
                        {bill.order.customerName && <Typography sx={{ fontSize:11, color:"text.secondary" }}>{bill.order.customerName}</Typography>}
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight:700, color:"primary.main", whiteSpace:"nowrap" }}>₹{bill.total.toFixed(2)}</Typography>
                        {bill.tip > 0 && <Typography sx={{ fontSize:10, color:"text.secondary" }}>+₹{bill.tip} tip</Typography>}
                      </TableCell>
                      <TableCell>{bill.discount > 0 ? <Typography sx={{ color:"#16A34A", fontWeight:600, fontSize:13 }}>-₹{bill.discount.toFixed(2)}</Typography> : "—"}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>{statusBadge(bill)}</TableCell>
                      <TableCell sx={{ color:"text.secondary", fontSize:12, whiteSpace:"nowrap" }}>{new Date(bill.createdAt).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Stack direction="row" spacing={.5}>
                          <Button size="small" variant="contained" sx={{ fontSize:11, px:1, minWidth:0 }}
                            onClick={() => openPayModal(bill)} disabled={bill.paymentStatus==="PAID"||bill.billStatus==="VOID"}>Pay</Button>
                          <Button size="small" variant="outlined" sx={{ fontSize:11, px:1, minWidth:0 }} onClick={() => printBill(bill)}>🖨️</Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          }
        </Box>
      </Card>

{/* ── Payment Modal ── */}
      {payBill && (() => {
        const { t, ro, finalTotal } = computeFinalTotal(payBill);
        const balance = payBill.total - (payBill.paidAmount ?? 0);
        const baseTotal = balance > 0 && payBill.paymentStatus === "PARTIALLY_PAID" ? balance : payBill.total;
        const computedFinal = baseTotal + t + ro;
        return (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPayBill(null)}>
            <div className="modal" style={{ maxWidth: 480 }}>
              <h3 className="modal-title">💳 Collect Payment — Bill #{payBill.billNumber}</h3>

              {/* Bill Summary */}
              <div style={{ background: "#F8FAFC", borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "#64748B" }}>Subtotal</span><span>₹{payBill.subtotal.toFixed(2)}</span>
                </div>
                {payBill.discount > 0 && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "#64748B" }}>Discount</span><span style={{ color: "#16A34A" }}>-₹{payBill.discount.toFixed(2)}</span>
                </div>}
                {(payBill.cgst > 0 || payBill.sgst > 0) && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "#64748B" }}>Tax</span><span>₹{(payBill.cgst + payBill.sgst).toFixed(2)}</span>
                </div>}
                {payBill.paymentStatus === "PARTIALLY_PAID" && payBill.paidAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: "#64748B" }}>Already Paid</span><span style={{ color: "#16A34A" }}>₹{payBill.paidAmount.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingTop: 6, borderTop: "1px dashed #CBD5E1" }}>
                  <span style={{ fontWeight: 700 }}>Payable</span>
                  <span style={{ fontSize: 22, fontWeight: 800, color: "#E8721C" }}>₹{computedFinal.toFixed(2)}</span>
                </div>
              </div>

              {/* Tip */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label className="form-label">Tip (₹)</label>
                  <div style={{ display: "flex", gap: 4 }}>
                    <input className="form-input" type="number" min="0" placeholder="0" value={tip}
                      onChange={e => setTip(e.target.value)} style={{ flex: 1 }} />
                    {[10, 20, 50].map(v => (
                      <button key={v} className="btn btn-ghost btn-sm" onClick={() => setTip(String(v))}
                        style={{ padding: "4px 6px", fontSize: 11 }}>+{v}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="form-label">Round Off</label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, cursor: "pointer", fontSize: 13 }}>
                    <input type="checkbox" checked={roundOffAuto} onChange={e => setRoundOffAuto(e.target.checked)} />
                    Auto round-off {roundOffAuto && ro !== 0 && <span style={{ color: ro > 0 ? "#16A34A" : "#DC2626", fontWeight: 700 }}>({ro >= 0 ? "+" : ""}₹{ro.toFixed(2)})</span>}
                  </label>
                </div>
              </div>

              {/* Payment Mode */}
              {!splitMode && (
                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
                    {MODES.map(mode => (
                      <button key={mode} className={`btn ${payMode === mode ? "btn-primary" : "btn-ghost"}`}
                        style={{ justifyContent: "center", padding: "8px 4px", fontSize: 12 }}
                        onClick={() => setPayMode(mode)}>
                        {modeIcon[mode]} {mode}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Split Payment */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  <input type="checkbox" checked={splitMode} onChange={e => { setSplitMode(e.target.checked); setPartialMode(false); }} />
                  Split Payment (multiple modes)
                </label>
                {splitMode && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {splitPayments.map((sp, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 6 }}>
                        <select className="form-input" value={sp.mode}
                          onChange={e => { const u = [...splitPayments]; u[i].mode = e.target.value as Mode; setSplitPayments(u); }}
                          style={{ fontSize: 13 }}>
                          {MODES.map(m => <option key={m} value={m}>{modeIcon[m]} {m}</option>)}
                        </select>
                        <input className="form-input" type="number" min="0" placeholder="₹ amount"
                          value={sp.amount}
                          onChange={e => {
                            const u = [...splitPayments]; u[i].amount = e.target.value;
                            // Auto-fill second from remaining
                            if (splitPayments.length === 2 && i === 0) {
                              const rem = computedFinal - (parseFloat(e.target.value) || 0);
                              u[1].amount = rem > 0 ? rem.toFixed(2) : "";
                            }
                            setSplitPayments(u);
                          }} />
                      </div>
                    ))}
                    <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }}
                      onClick={() => setSplitPayments([...splitPayments, { mode: "CASH", amount: "" }])}>
                      + Add Mode
                    </button>
                  </div>
                )}
              </div>

              {/* Partial Payment */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  <input type="checkbox" checked={partialMode} onChange={e => { setPartialMode(e.target.checked); setSplitMode(false); }} />
                  Partial Payment (pay now, rest later)
                </label>
                {partialMode && (
                  <div>
                    <input className="form-input" type="number" min="1" max={computedFinal}
                      placeholder={`Max ₹${computedFinal.toFixed(2)}`} value={partialAmount}
                      onChange={e => setPartialAmount(e.target.value)} />
                    {partialAmount && parseFloat(partialAmount) < computedFinal && (
                      <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
                        Balance due: ₹{(computedFinal - parseFloat(partialAmount)).toFixed(2)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setPayBill(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={collectPayment} disabled={loading}>
                  {loading ? "Processing…" : partialMode ? `Collect ₹${partialAmount || "0"}` : `✓ Collect ₹${computedFinal.toFixed(2)}`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Void Modal ── */}
      {voidBill && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setVoidBill(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <h3 className="modal-title">🚫 Void Bill #{voidBill.billNumber}</h3>
            <p style={{ fontSize: 13, color: "#64748B", marginBottom: 14 }}>
              This will cancel the bill and reset the order. The table will become available again.
            </p>
            <div className="form-group">
              <label className="form-label">Void Reason *</label>
              <textarea className="form-input" rows={2} placeholder="Why is this bill being voided?"
                value={voidReason} onChange={e => setVoidReason(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setVoidBill(null)}>Cancel</button>
              <button className="btn" style={{ background: "#DC2626", color: "#fff" }}
                onClick={submitVoid} disabled={loading || !voidReason.trim()}>
                {loading ? "Voiding…" : "Confirm Void"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Refund Modal ── */}
      {refundBill && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setRefundBill(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <h3 className="modal-title">↩ Refund — Bill #{refundBill.billNumber}</h3>
            <div style={{ background: "#F8FAFC", borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748B" }}>Bill Total</span>
                <span style={{ fontWeight: 700 }}>₹{refundBill.total.toFixed(2)}</span>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Refund Amount (leave blank for full refund)</label>
              <input className="form-input" type="number" min="0.01" max={refundBill.total}
                placeholder={`₹${refundBill.total.toFixed(2)} (full)`}
                value={refundAmount} onChange={e => setRefundAmount(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Refund Reason *</label>
              <textarea className="form-input" rows={2} placeholder="Reason for refund…"
                value={refundReason} onChange={e => setRefundReason(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setRefundBill(null)}>Cancel</button>
              <button className="btn" style={{ background: "#7C3AED", color: "#fff" }}
                onClick={submitRefund} disabled={loading || !refundReason.trim()}>
                {loading ? "Processing…" : `Refund ₹${refundAmount || refundBill.total.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bill Detail Modal ── */}
      {detailBill && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDetailBill(null)}>
          <div className="modal" style={{ maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 className="modal-title" style={{ margin: 0 }}>Bill #{detailBill.billNumber}</h3>
              {statusBadge(detailBill)}
            </div>
            <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
              {/* Order meta */}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748B" }}>Order #</span><span>#{detailBill.order.orderNumber}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748B" }}>Table/Type</span>
                <span>{detailBill.order.table ? `Table ${detailBill.order.table.number}` : detailBill.order.type}</span>
              </div>
              {detailBill.order.source && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748B" }}>Source</span>
                  <span style={{ background: detailBill.order.source === "QR" ? "#FEF3C7" : "#F1F5F9", color: detailBill.order.source === "QR" ? "#CA8A04" : "#475569", padding: "1px 8px", borderRadius: 5, fontWeight: 600 }}>
                    {detailBill.order.source === "QR" ? "📱 QR Scan" : "🖥️ POS"}
                  </span>
                </div>
              )}
              {detailBill.order.createdBy && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748B" }}>Created By</span>
                  <span>{detailBill.order.createdBy.name} <span style={{ color: "#94A3B8", fontSize: 11 }}>({detailBill.order.createdBy.role})</span></span>
                </div>
              )}

              {/* Customer */}
              {(detailBill.order.customerName || detailBill.order.customer) && (
                <>
                  <hr style={{ border: "none", borderTop: "1px dashed #E2E8F0", margin: "4px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748B" }}>Customer</span>
                    <span style={{ fontWeight: 600 }}>{detailBill.order.customer?.name ?? detailBill.order.customerName}</span>
                  </div>
                  {detailBill.order.customerPhone && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748B" }}>Phone</span><span>{detailBill.order.customerPhone}</span>
                    </div>
                  )}
                  {detailBill.order.customer && (
                    <div style={{ background: "#F8FAFC", borderRadius: 8, padding: "8px 12px", fontSize: 12, display: "flex", gap: 16 }}>
                      <span>🏆 {detailBill.order.customer.loyaltyPoints} pts</span>
                      <span>🛍️ {detailBill.order.customer.totalVisits} visits</span>
                      <span>💰 ₹{detailBill.order.customer.totalSpent.toFixed(0)} spent</span>
                    </div>
                  )}
                </>
              )}

              {/* Items */}
              <hr style={{ border: "none", borderTop: "1px dashed #E2E8F0", margin: "4px 0" }} />
              {detailBill.order.items.map((item, i) => (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{item.menuItem.name} × {item.quantity}</span>
                    <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                  {item.notes && <div style={{ fontSize: 11, color: "#94A3B8", paddingLeft: 8 }}>📝 {item.notes}</div>}
                </div>
              ))}
              {detailBill.order.kotNote && (
                <div style={{ fontSize: 12, color: "#64748B", background: "#FEF9C3", padding: "4px 8px", borderRadius: 6 }}>
                  📋 {detailBill.order.kotNote}
                </div>
              )}

              {/* Totals */}
              <hr style={{ border: "none", borderTop: "1px dashed #E2E8F0", margin: "4px 0" }} />
              {[
                ["Subtotal", `₹${detailBill.subtotal.toFixed(2)}`],
                detailBill.discount > 0 ? ["Discount", `-₹${detailBill.discount.toFixed(2)}`] : null,
                (detailBill.cgst + detailBill.sgst) > 0 ? ["Tax (GST)", `₹${(detailBill.cgst + detailBill.sgst).toFixed(2)}`] : null,
                detailBill.tip > 0 ? ["Tip", `₹${detailBill.tip.toFixed(2)}`] : null,
                detailBill.roundOff !== 0 ? ["Round Off", `${detailBill.roundOff >= 0 ? "+" : ""}₹${detailBill.roundOff.toFixed(2)}`] : null,
              ].filter(Boolean).map((row, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", color: "#64748B" }}>
                  <span>{row![0]}</span><span>{row![1]}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 16, marginTop: 4 }}>
                <span>Total</span><span style={{ color: "#E8721C" }}>₹{detailBill.total.toFixed(2)}</span>
              </div>
              {detailBill.paidAmount > 0 && detailBill.paidAmount < detailBill.total && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#16A34A" }}>
                    <span>Paid</span><span>₹{detailBill.paidAmount.toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#DC2626" }}>
                    <span>Balance</span><span>₹{(detailBill.total - detailBill.paidAmount).toFixed(2)}</span>
                  </div>
                </>
              )}
              {detailBill.refundAmount > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "#7C3AED" }}>
                <span>Refunded</span><span>₹{detailBill.refundAmount.toFixed(2)}</span>
              </div>}
              {detailBill.refundReason && <div style={{ color: "#64748B", fontSize: 12 }}>Refund reason: {detailBill.refundReason}</div>}
              {detailBill.voidReason && <div style={{ color: "#DC2626", fontSize: 12 }}>Void reason: {detailBill.voidReason}</div>}
              {detailBill.splitPayments && (
                <div>
                  <div style={{ color: "#64748B", marginBottom: 4 }}>Split Payments:</div>
                  {(detailBill.splitPayments as SplitEntry[]).map((sp, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", paddingLeft: 8 }}>
                      <span>{modeIcon[sp.mode]} {sp.mode}</span><span>₹{sp.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ color: "#94A3B8", fontSize: 12, marginTop: 4 }}>
                Created: {new Date(detailBill.createdAt).toLocaleString("en-IN")}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16, flexWrap: "wrap" }}>
              {isOwner && (
                <>
                  <button className="btn btn-ghost" style={{ color: "#1D4ED8", borderColor: "#DBEAFE" }}
                    onClick={() => { setEditName(detailBill.order.customerName ?? ""); setEditPhone(detailBill.order.customerPhone ?? ""); setEditBill(detailBill); setDetailBill(null); }}>
                    ✏️ Edit
                  </button>
                  <button className="btn btn-ghost" style={{ color: "#DC2626", borderColor: "#FEE2E2" }}
                    onClick={() => { setDeleteBill(detailBill); setDetailBill(null); }}>
                    🗑️ Delete Order
                  </button>
                </>
              )}
              <button className="btn btn-ghost" onClick={() => printBill(detailBill)}>🖨️ Print</button>
              <button className="btn btn-ghost" onClick={() => setDetailBill(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit order modal (owner only) */}
      {editBill && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditBill(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <h3 className="modal-title" style={{ marginTop: 0 }}>✏️ Edit Order #{editBill.order.orderNumber}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#64748B", display: "block", marginBottom: 4 }}>Customer Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Customer name"
                  style={{ width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#64748B", display: "block", marginBottom: 4 }}>Phone Number</label>
                <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="Phone number" type="tel"
                  style={{ width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setEditBill(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveOrderEdit} disabled={editSaving}>
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete order confirmation (owner only) */}
      {deleteBill && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteBill(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <h3 className="modal-title" style={{ marginTop: 0, color: "#DC2626" }}>🗑️ Delete Order</h3>
            <p style={{ fontSize: 14, color: "#475569", margin: "0 0 8px" }}>
              Are you sure you want to permanently delete <strong>Order #{deleteBill.order.orderNumber}</strong>?
            </p>
            <p style={{ fontSize: 12, color: "#94A3B8", margin: 0 }}>
              This will also delete the associated bill. This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setDeleteBill(null)}>Cancel</button>
              <button onClick={deleteOrder} disabled={deleting}
                style={{ background: deleting ? "#94A3B8" : "#DC2626", color: "white", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 700, fontSize: 14, cursor: deleting ? "not-allowed" : "pointer" }}>
                {deleting ? "Deleting…" : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Box>
  );
}
