"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { showToast } from "@/components/Toast";

const KITCHENS = ["ALL", "MAIN", "GRILL", "BAR", "TANDOOR"];
const COLS = [
  { status: "PENDING",   label: "New Orders",  emoji: "🔴", bg: "#FFF7ED", border: "#FB923C", text: "#EA580C", hdr: "#FED7AA" },
  { status: "PREPARING", label: "Cooking",      emoji: "🔵", bg: "#EFF6FF", border: "#60A5FA", text: "#2563EB", hdr: "#BFDBFE" },
  { status: "READY",     label: "Ready ✓",     emoji: "🟢", bg: "#F0FDF4", border: "#4ADE80", text: "#16A34A", hdr: "#BBF7D0" },
];
const NEXT: Record<string, string>  = { PENDING: "PREPARING", PREPARING: "READY", READY: "SERVED" };
const NEXT_LBL: Record<string, string> = { PENDING: "▶ Start Cooking", PREPARING: "✓ Mark Ready", READY: "🍽 Serve" };

type OItem = { id: string; quantity: number; notes?: string; kitchen?: string; menuItem: { name: string } };
type Order = {
  id: string; orderNumber: number; status: string; type: string; createdAt: string;
  isPriority: boolean; kotNote?: string;
  customerName?: string; table?: { number: string };
  items: OItem[];
};

function Timer({ createdAt }: { createdAt: string }) {
  const [mins, setMins] = useState(0);
  useEffect(() => {
    const calc = () => setMins(Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
    calc();
    const iv = setInterval(calc, 15000);
    return () => clearInterval(iv);
  }, [createdAt]);
  const late = mins >= 20; const warn = mins >= 10;
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, padding: "2px 7px", borderRadius: 10,
      color: late ? "#DC2626" : warn ? "#D97706" : "#16A34A",
      background: late ? "#FEE2E2" : warn ? "#FEF3C7" : "#DCFCE7",
      border: `1px solid ${late ? "#FCA5A5" : warn ? "#FDE68A" : "#86EFAC"}`,
      animation: late ? "kdsBlink 1s ease-in-out infinite" : "none",
      display: "inline-flex", alignItems: "center", gap: 3,
    }}>⏱ {mins}m</span>
  );
}

function useSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  return useCallback((type: "new" | "ready") => {
    try {
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const freqs = type === "new" ? [880, 1100] : [660, 880];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq; osc.type = "sine";
        const t = ctx.currentTime + i * 0.15;
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.start(t); osc.stop(t + 0.3);
      });
    } catch {}
  }, []);
}

export default function KitchenDisplayPage() {
  const [orders, setOrders]       = useState<Order[]>([]);
  const [loading, setLoading]     = useState(true);
  const [kitchen, setKitchen]     = useState("ALL");
  const [soundOn, setSoundOn]     = useState(true);
  const [dragging, setDragging]   = useState<string | null>(null);
  const [dropOver, setDropOver]   = useState<string | null>(null);
  const [busy, setBusy]           = useState<string | null>(null);
  const prevIds = useRef<Set<string>>(new Set());
  const pageRef = useRef<HTMLDivElement>(null);
  const [isFs, setIsFs]           = useState(false);
  const play = useSound();
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/orders");
      const d = await r.json();
      const active: Order[] = (d.orders ?? []).filter((o: Order) =>
        ["PENDING", "PREPARING", "READY"].includes(o.status)
      );
      const newOnes = active.filter(o => !prevIds.current.has(o.id));
      if (newOnes.length > 0 && prevIds.current.size > 0 && soundRef.current) play("new");
      prevIds.current = new Set(active.map(o => o.id));
      active.sort((a, b) => {
        if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      setOrders(active);
    } finally { setLoading(false); }
  }, [play]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 12000);
    return () => clearInterval(iv);
  }, [load]);

  useEffect(() => {
    const handler = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  function toggleFs() {
    if (!document.fullscreenElement) { pageRef.current?.requestFullscreen(); }
    else document.exitFullscreen();
  }

  async function advance(order: Order) {
    const next = NEXT[order.status];
    if (!next || busy) return;
    setBusy(order.id);
    try {
      const r = await fetch(`/api/orders/${order.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (r.ok) {
        if (next === "READY" && soundRef.current) play("ready");
        showToast(`KOT #${order.orderNumber} → ${next}`, "success");
        load();
      } else showToast("Update failed", "error");
    } finally { setBusy(null); }
  }

  // Drag & Drop
  function onDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.setData("orderId", id);
    setDragging(id);
  }
  function onDragEnd() { setDragging(null); setDropOver(null); }
  function onDragOver(e: React.DragEvent, status: string) { e.preventDefault(); setDropOver(status); }
  function onDragLeave() { setDropOver(null); }
  async function onDrop(e: React.DragEvent, toStatus: string) {
    e.preventDefault(); setDropOver(null); setDragging(null);
    const orderId = e.dataTransfer.getData("orderId");
    const order = orders.find(o => o.id === orderId);
    if (!order || order.status === toStatus) return;
    const ok = (order.status === "PENDING" && toStatus === "PREPARING") ||
               (order.status === "PREPARING" && toStatus === "READY");
    if (!ok) { showToast("Can only move forward in sequence", "error"); return; }
    setBusy(orderId);
    try {
      const r = await fetch(`/api/orders/${order.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: toStatus }),
      });
      if (r.ok) {
        if (toStatus === "READY" && soundRef.current) play("ready");
        showToast(`KOT #${order.orderNumber} → ${toStatus}`, "success");
        load();
      }
    } finally { setBusy(null); }
  }

  function visibleItems(order: Order) {
    if (kitchen === "ALL") return order.items;
    const tagged = order.items.filter(i => i.kitchen === kitchen);
    return tagged.length > 0 ? tagged : order.items;
  }

  const colOrders = (status: string) => orders.filter(o => o.status === status);

  return (
    <div ref={pageRef} style={{ minHeight: "100vh", background: "#F1F5F9", display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes kdsBlink { 0%,100%{opacity:1} 50%{opacity:0.25} }
        .kds-card { transition: transform 0.15s, box-shadow 0.15s; cursor: grab; }
        .kds-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.12); }
        .kds-card.dragging { opacity: 0.4; transform: scale(0.97); }
        .kds-drop-active { outline: 3px dashed #E8721C; outline-offset: -3px; background: #FFF7ED !important; }
        .kds-btn { transition: all 0.15s; font-weight: 700; cursor: pointer; border: none; border-radius: 8px; padding: 7px 14px; font-size: 12px; }
        .kds-btn:hover { filter: brightness(0.92); transform: scale(0.98); }
        .kds-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      {/* Top bar */}
      <div style={{ background: "#0F172A", color: "white", padding: "10px 20px", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}>📺 Kitchen Display</span>
        <div style={{ flex: 1 }} />
        {/* Kitchen filter */}
        <div style={{ display: "flex", gap: 6 }}>
          {KITCHENS.map(k => (
            <button key={k} onClick={() => setKitchen(k)} className="kds-btn" style={{
              background: kitchen === k ? "#E8721C" : "#1E293B", color: kitchen === k ? "white" : "#94A3B8",
              padding: "5px 12px", fontSize: 11,
            }}>{k}</button>
          ))}
        </div>
        <div style={{ width: 1, background: "#334155", height: 28 }} />
        {/* Sound toggle */}
        <button onClick={() => setSoundOn(s => !s)} className="kds-btn" style={{
          background: soundOn ? "#166534" : "#7F1D1D", color: "white", padding: "5px 10px",
        }} title={soundOn ? "Sound ON" : "Sound OFF"}>
          {soundOn ? "🔊" : "🔇"}
        </button>
        {/* Refresh */}
        <button onClick={load} className="kds-btn" style={{ background: "#1E293B", color: "#94A3B8", padding: "5px 10px" }} title="Refresh">
          🔄
        </button>
        {/* Fullscreen */}
        <button onClick={toggleFs} className="kds-btn" style={{ background: "#1E293B", color: "#94A3B8", padding: "5px 10px" }} title="Toggle Fullscreen">
          {isFs ? "⊡" : "⛶"}
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ background: "#1E293B", padding: "6px 20px", display: "flex", gap: 24, flexShrink: 0 }}>
        {COLS.map(col => {
          const cnt = colOrders(col.status).length;
          return (
            <div key={col.status} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#94A3B8" }}>{col.emoji} {col.label}</span>
              <span style={{
                background: col.text, color: "white", borderRadius: 10, fontSize: 11, fontWeight: 700,
                padding: "1px 7px", minWidth: 22, textAlign: "center",
              }}>{cnt}</span>
            </div>
          );
        })}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "#475569" }}>
          {loading ? "Syncing..." : `Auto-sync every 12s · ${orders.length} active`}
        </span>
      </div>

      {/* Kanban columns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, padding: 16, flex: 1, minHeight: 0 }}>
        {COLS.map(col => {
          const colList = colOrders(col.status);
          const isDropTarget = dropOver === col.status;
          return (
            <div
              key={col.status}
              onDragOver={e => onDragOver(e, col.status)}
              onDragLeave={onDragLeave}
              onDrop={e => onDrop(e, col.status)}
              className={isDropTarget ? "kds-drop-active" : ""}
              style={{
                background: isDropTarget ? "#FFF7ED" : col.bg,
                border: `2px solid ${isDropTarget ? "#E8721C" : col.border}`,
                borderRadius: 14, display: "flex", flexDirection: "column",
                transition: "all 0.15s",
              }}
            >
              {/* Column header */}
              <div style={{
                background: col.hdr, borderRadius: "12px 12px 0 0",
                padding: "10px 14px", display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ fontSize: 16 }}>{col.emoji}</span>
                <span style={{ fontWeight: 800, fontSize: 14, color: col.text }}>{col.label}</span>
                <span style={{
                  marginLeft: "auto", background: col.text, color: "white",
                  borderRadius: "50%", width: 24, height: 24, display: "flex",
                  alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800,
                }}>{colList.length}</span>
              </div>

              {/* Cards */}
              <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px 10px 10px", display: "flex", flexDirection: "column", gap: 10 }}>
                {colList.length === 0 && (
                  <div style={{ textAlign: "center", color: "#CBD5E1", fontSize: 13, marginTop: 32, userSelect: "none" }}>
                    {isDropTarget ? "Drop here" : "No orders"}
                  </div>
                )}
                {colList.map(order => {
                  const items = visibleItems(order);
                  const isDragging = dragging === order.id;
                  const isBusy = busy === order.id;
                  const nextStatus = NEXT[order.status];
                  return (
                    <div
                      key={order.id}
                      draggable
                      onDragStart={e => onDragStart(e, order.id)}
                      onDragEnd={onDragEnd}
                      className={`kds-card ${isDragging ? "dragging" : ""}`}
                      style={{
                        background: "white", borderRadius: 10, padding: "12px",
                        border: `1.5px solid ${order.isPriority ? "#E8721C" : "#E2E8F0"}`,
                        boxShadow: order.isPriority ? "0 0 0 2px #FED7AA" : "0 2px 6px rgba(0,0,0,0.06)",
                        opacity: isDragging ? 0.4 : 1,
                      }}
                    >
                      {/* Card header */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        {order.isPriority && (
                          <span style={{ fontSize: 11, fontWeight: 800, background: "#FFF7ED", color: "#E8721C", border: "1px solid #FB923C", padding: "1px 6px", borderRadius: 6 }}>
                            ★ PRIORITY
                          </span>
                        )}
                        <span style={{ fontWeight: 800, fontSize: 16, color: "#0F172A" }}>KOT #{order.orderNumber}</span>
                        <div style={{ flex: 1 }} />
                        <Timer createdAt={order.createdAt} />
                      </div>

                      {/* Location & type */}
                      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 8,
                          background: order.type === "DINE_IN" ? "#EFF6FF" : order.type === "TAKEAWAY" ? "#F0FDF4" : "#FFF7ED",
                          color: order.type === "DINE_IN" ? "#2563EB" : order.type === "TAKEAWAY" ? "#16A34A" : "#EA580C",
                        }}>
                          {order.type === "DINE_IN" ? `🪑 Table ${order.table?.number ?? "?"}` : order.type === "TAKEAWAY" ? "🥡 Takeaway" : "🛵 Delivery"}
                        </span>
                        {order.customerName && (
                          <span style={{ fontSize: 11, color: "#64748B", padding: "2px 6px", background: "#F8FAFC", borderRadius: 6, border: "1px solid #E2E8F0" }}>
                            👤 {order.customerName}
                          </span>
                        )}
                      </div>

                      {/* Items */}
                      <div style={{ borderTop: "1px solid #F1F5F9", borderBottom: "1px solid #F1F5F9", padding: "7px 0", marginBottom: 8 }}>
                        {items.map((item, i) => (
                          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "2px 0" }}>
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>{item.menuItem.name}</span>
                              {item.notes && <span style={{ fontSize: 10, color: "#94A3B8", marginLeft: 6 }}>({item.notes})</span>}
                              {item.kitchen && kitchen === "ALL" && (
                                <span style={{ fontSize: 9, fontWeight: 700, background: "#E2E8F0", color: "#475569", borderRadius: 4, padding: "0 4px", marginLeft: 4 }}>
                                  {item.kitchen}
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 800, color: "#E8721C", minWidth: 28, textAlign: "right" }}>×{item.quantity}</span>
                          </div>
                        ))}
                        {kitchen !== "ALL" && items.length !== order.items.length && (
                          <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>
                            +{order.items.length - items.length} item(s) for other stations
                          </div>
                        )}
                      </div>

                      {/* KOT note */}
                      {order.kotNote && (
                        <div style={{ fontSize: 11, color: "#D97706", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6, padding: "4px 8px", marginBottom: 8 }}>
                          📝 {order.kotNote}
                        </div>
                      )}

                      {/* Action button */}
                      {nextStatus && (
                        <button
                          onClick={() => advance(order)}
                          disabled={!!isBusy}
                          className="kds-btn"
                          style={{
                            width: "100%", textAlign: "center",
                            background: col.status === "PENDING" ? "#2563EB" : col.status === "PREPARING" ? "#16A34A" : "#E8721C",
                            color: "white",
                          }}
                        >
                          {isBusy ? "..." : NEXT_LBL[order.status]}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
