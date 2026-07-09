"use client";
import { useState, useEffect, useCallback } from "react";
import { showToast } from "@/components/Toast";

type Bill = {
  id: string; billNumber: number; subtotal: number; cgst: number; sgst: number;
  discount: number; total: number; paymentMode: string | null;
  paymentStatus: "PENDING" | "PAID"; createdAt: string;
  order: {
    orderNumber: number; type: string; customerName?: string;
    table?: { number: string };
    items: { quantity: number; price: number; menuItem: { name: string } }[];
  };
};

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [payMode, setPayMode] = useState<"CASH" | "UPI" | "CARD" | "CREDIT">("CASH");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "PENDING" | "PAID">("all");

  const loadBills = useCallback(async () => {
    const res = await fetch("/api/bills");
    const data = await res.json();
    setBills(data.bills ?? []);
  }, []);

  useEffect(() => { loadBills(); }, [loadBills]);

  async function markPaid(bill: Bill) {
    setLoading(true);
    try {
      const res = await fetch(`/api/bills/${bill.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMode: payMode }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast(`Bill #${bill.billNumber} marked as paid!`);
      setSelectedBill(null);
      await loadBills();
    } catch (err: any) {
      showToast(err.message ?? "Payment failed", "error");
    } finally {
      setLoading(false);
    }
  }

  function printBill(bill: Bill) {
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    w.document.write(`
      <html><head><title>Bill #${bill.billNumber}</title>
      <style>
        body { font-family: monospace; font-size: 13px; padding: 16px; max-width: 300px; margin: 0 auto; }
        h2 { text-align: center; margin: 0 0 4px; font-size: 16px; }
        p { text-align: center; margin: 2px 0; font-size: 11px; }
        hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; margin: 3px 0; }
        .total { font-weight: bold; font-size: 14px; }
      </style></head><body>
      <h2>🍽️ RestoBill</h2>
      <p>Bill #${bill.billNumber}</p>
      <p>${new Date(bill.createdAt).toLocaleString("en-IN")}</p>
      ${bill.order.table ? `<p>Table: ${bill.order.table.number}</p>` : ""}
      ${bill.order.customerName ? `<p>Customer: ${bill.order.customerName}</p>` : ""}
      <hr/>
      ${bill.order.items.map((i) => `<div class="row"><span>${i.menuItem.name} x${i.quantity}</span><span>₹${(i.price * i.quantity).toFixed(2)}</span></div>`).join("")}
      <hr/>
      <div class="row"><span>Subtotal</span><span>₹${bill.subtotal.toFixed(2)}</span></div>
      ${bill.discount > 0 ? `<div class="row"><span>Discount</span><span>-₹${bill.discount.toFixed(2)}</span></div>` : ""}
      <div class="row"><span>CGST (2.5%)</span><span>₹${bill.cgst.toFixed(2)}</span></div>
      <div class="row"><span>SGST (2.5%)</span><span>₹${bill.sgst.toFixed(2)}</span></div>
      <hr/>
      <div class="row total"><span>TOTAL</span><span>₹${bill.total.toFixed(2)}</span></div>
      ${bill.paymentMode ? `<div class="row"><span>Payment</span><span>${bill.paymentMode}</span></div>` : ""}
      <hr/>
      <p>Thank you! Visit us again 🙏</p>
      </body></html>
    `);
    w.document.close();
    w.print();
  }

  const filtered = bills.filter((b) => filter === "all" || b.paymentStatus === filter);
  const todayRevenue = bills.filter((b) => b.paymentStatus === "PAID" && new Date(b.createdAt).toDateString() === new Date().toDateString()).reduce((s, b) => s + b.total, 0);

  return (
    <div>
      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Today's Revenue</div>
          <div className="stat-value" style={{ color: "#16A34A" }}>₹{todayRevenue.toFixed(0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Bills</div>
          <div className="stat-value" style={{ color: "#D97706" }}>{bills.filter((b) => b.paymentStatus === "PENDING").length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Bills Today</div>
          <div className="stat-value">{bills.filter((b) => new Date(b.createdAt).toDateString() === new Date().toDateString()).length}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Bills</h3>
          <div style={{ display: "flex", gap: 8 }}>
            {(["all", "PENDING", "PAID"] as const).map((f) => (
              <button key={f} className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f}
              </button>
            ))}
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#94A3B8" }}>
              <p>No bills yet. Generate bills from the Tables page.</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                  {["Bill #", "Order #", "Table/Type", "Items", "Total", "Status", "Time", "Actions"].map((h) => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((bill) => (
                  <tr key={bill.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 700 }}>#{bill.billNumber}</td>
                    <td style={{ padding: "12px 16px" }}>#{bill.order.orderNumber}</td>
                    <td style={{ padding: "12px 16px" }}>
                      {bill.order.table ? `Table ${bill.order.table.number}` : bill.order.type}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#64748B" }}>{bill.order.items.length} items</td>
                    <td style={{ padding: "12px 16px", fontWeight: 700, color: "#E8721C" }}>₹{bill.total.toFixed(2)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span className={`badge badge-${bill.paymentStatus.toLowerCase()}`}>
                        {bill.paymentStatus}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#64748B" }}>
                      {new Date(bill.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => printBill(bill)}>🖨️ Print</button>
                        {bill.paymentStatus === "PENDING" && (
                          <button className="btn btn-success btn-sm" onClick={() => setSelectedBill(bill)}>💳 Pay</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Payment modal */}
      {selectedBill && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedBill(null)}>
          <div className="modal">
            <h3 className="modal-title">Collect Payment — Bill #{selectedBill.billNumber}</h3>
            <div style={{ background: "#F8FAFC", borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#64748B" }}>Amount to collect</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: "#E8721C" }}>₹{selectedBill.total.toFixed(2)}</span>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Payment Mode</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {(["CASH", "UPI", "CARD", "CREDIT"] as const).map((mode) => (
                  <button
                    key={mode}
                    className={`btn ${payMode === mode ? "btn-primary" : "btn-ghost"}`}
                    style={{ justifyContent: "center" }}
                    onClick={() => setPayMode(mode)}
                  >
                    {mode === "CASH" ? "💵 Cash" : mode === "UPI" ? "📱 UPI" : mode === "CARD" ? "💳 Card" : "📝 Credit"}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setSelectedBill(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => markPaid(selectedBill)} disabled={loading}>
                {loading ? "Processing..." : "✓ Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
