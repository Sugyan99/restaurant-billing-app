"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";

type QrItem = { menuItemId: string; name: string; price: number; isVeg: boolean; quantity: number; notes?: string };
type QrOrder = {
  id: string; tableNumber: string; customerName: string;
  status: string; items: QrItem[]; notes?: string; createdAt: string;
  feedback?: { rating: number } | null;
};

const STATUS_STEPS = [
  { key: "PENDING",   label: "Order Placed",    icon: "📱", desc: "Waiting for waiter confirmation" },
  { key: "APPROVED",  label: "Confirmed",        icon: "✅", desc: "Order confirmed & sent to kitchen" },
  { key: "PREPARING", label: "Being Prepared",   icon: "👨‍🍳", desc: "Kitchen is cooking your order" },
  { key: "READY",     label: "Ready to Serve",   icon: "🔔", desc: "Your food is on the way!" },
  { key: "SERVED",    label: "Served",           icon: "🍽️", desc: "Enjoy your meal!" },
];

const REJECTED_STEP = { key: "REJECTED", label: "Order Declined", icon: "❌", desc: "Please ask your waiter for help." };

function StatusContent() {
  const { id }     = useParams<{ id: string }>();
  const search     = useSearchParams();
  const tableNum   = search.get("table") ?? "";
  const [qrOrder, setQrOrder]       = useState<QrOrder | null>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [loading, setLoading]        = useState(true);
  const [rating, setRating]          = useState(0);
  const [comment, setComment]        = useState("");
  const [submitted, setSubmitted]    = useState(false);
  const [submitting, setSubmitting]  = useState(false);

  const fetch_ = useCallback(() => {
    fetch(`/api/qr/order/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setQrOrder(d.qrOrder);
        setOrderStatus(d.orderStatus);
        setLoading(false);
        if (d.qrOrder?.feedback) setSubmitted(true);
      })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetch_();
    const iv = setInterval(fetch_, 6000);
    return () => clearInterval(iv);
  }, [fetch_]);

  async function submitFeedback() {
    if (!rating) return alert("Please select a rating");
    setSubmitting(true);
    const res = await fetch("/api/qr/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrOrderId: id, rating, comment }),
    });
    setSubmitting(false);
    if (res.ok) setSubmitted(true);
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", flexDirection: "column", gap: 12, fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ width: 40, height: 40, border: "3px solid #E8721C", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <p style={{ color: "#94A3B8", fontSize: 14 }}>Loading status…</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!qrOrder) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", textAlign: "center", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div><div style={{ fontSize: 48 }}>❓</div><h2>Order not found</h2><a href={`/menu?table=${tableNum}`} style={{ color: "#E8721C" }}>Back to Menu</a></div>
    </div>
  );

  const isRejected = qrOrder.status === "REJECTED";
  const steps      = isRejected ? [REJECTED_STEP] : STATUS_STEPS;
  const liveStatus = orderStatus ?? qrOrder.status;
  const activeIdx  = isRejected ? 0 : STATUS_STEPS.findIndex((s) => s.key === liveStatus);
  const total      = (qrOrder.items as QrItem[]).reduce((s, i) => s + i.price * i.quantity, 0);
  const isServed   = liveStatus === "SERVED";

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#FFFBF7", fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}} * { box-sizing: border-box; }`}</style>

      {/* Header */}
      <div style={{ background: "#0F1623", color: "white", padding: "16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#E8721C" }}>Order Status</h1>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94A3B8" }}>Table {qrOrder.tableNumber} · {qrOrder.customerName}</p>
          </div>
          <a href={`/menu?table=${tableNum}`} style={{ background: "rgba(255,255,255,0.1)", color: "white", borderRadius: 8, padding: "6px 12px", fontSize: 12, textDecoration: "none", fontWeight: 600 }}>+ New Order</a>
        </div>
      </div>

      <div style={{ padding: "20px 16px" }}>
        {/* Status stepper */}
        <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", padding: "20px 16px", marginBottom: 16 }}>
          {steps.map((step, i) => {
            const done    = !isRejected && i < activeIdx;
            const current = i === activeIdx;
            const pending = !isRejected && i > activeIdx;
            return (
              <div key={step.key} style={{ display: "flex", gap: 12, marginBottom: i < steps.length - 1 ? 0 : 0 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                    background: isRejected ? "#FEE2E2" : done ? "#DCFCE7" : current ? "#FFF0E5" : "#F1F5F9",
                    border: `2px solid ${isRejected ? "#DC2626" : done ? "#16A34A" : current ? "#E8721C" : "#E2E8F0"}`,
                    animation: current && !isRejected ? "pulse 2s ease infinite" : "none",
                    flexShrink: 0,
                  }}>
                    {step.icon}
                  </div>
                  {i < steps.length - 1 && (
                    <div style={{ width: 2, flex: 1, minHeight: 24, background: done ? "#16A34A" : "#E2E8F0", margin: "4px 0" }} />
                  )}
                </div>
                <div style={{ paddingTop: 8, paddingBottom: i < steps.length - 1 ? 20 : 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: pending ? "#94A3B8" : "#0F1623" }}>{step.label}</div>
                  {current && <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{step.desc}</div>}
                  {current && !isRejected && (
                    <div style={{ fontSize: 11, color: "#E8721C", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#E8721C", display: "inline-block", animation: "pulse 1.5s ease infinite" }} />
                      Live update every 6s
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Order summary */}
        <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", padding: 16, marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700 }}>Order Summary</h3>
          {(qrOrder.items as QrItem[]).map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #F1F5F9", fontSize: 14 }}>
              <div>
                <span style={{ fontWeight: 600 }}>{item.name}</span>
                <span style={{ color: "#94A3B8" }}> × {item.quantity}</span>
                {item.notes && <div style={{ fontSize: 11, color: "#94A3B8" }}>Note: {item.notes}</div>}
              </div>
              <span style={{ fontWeight: 700 }}>₹{(item.price * item.quantity).toFixed(0)}</span>
            </div>
          ))}
          {qrOrder.notes && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#64748B", background: "#F8FAFC", borderRadius: 8, padding: "8px 10px" }}>
              📝 {qrOrder.notes}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontWeight: 800, fontSize: 16 }}>
            <span>Total</span><span style={{ color: "#E8721C" }}>₹{total.toFixed(0)}</span>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "#94A3B8" }}>* Tax &amp; charges to be calculated at billing</p>
        </div>

        {/* Feedback */}
        {isServed && (
          <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", padding: 16 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700 }}>Rate Your Experience</h3>
            {submitted ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div style={{ fontSize: 40 }}>🙏</div>
                <p style={{ fontWeight: 700, margin: "8px 0 4px" }}>Thank you!</p>
                <p style={{ fontSize: 13, color: "#94A3B8", margin: 0 }}>Your feedback helps us improve.</p>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 14 }}>
                  {[1,2,3,4,5].map((r) => (
                    <button key={r} onClick={() => setRating(r)} style={{ fontSize: 28, background: "none", border: "none", cursor: "pointer", transform: r <= rating ? "scale(1.2)" : "scale(1)", transition: "transform 0.1s", filter: r <= rating ? "none" : "grayscale(1)" }}>
                      ⭐
                    </button>
                  ))}
                </div>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Tell us more (optional)…" rows={3}
                  style={{ width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 10, padding: "10px 12px", fontSize: 13, outline: "none", resize: "none", fontFamily: "inherit", marginBottom: 10 }} />
                <button onClick={submitFeedback} disabled={submitting || !rating}
                  style={{ width: "100%", background: !rating || submitting ? "#94A3B8" : "#E8721C", color: "white", border: "none", borderRadius: 10, padding: 12, fontWeight: 700, fontSize: 14, cursor: !rating || submitting ? "not-allowed" : "pointer" }}>
                  {submitting ? "Submitting…" : "Submit Feedback"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function StatusPage() {
  return (
    <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>Loading…</div>}>
      <StatusContent />
    </Suspense>
  );
}
