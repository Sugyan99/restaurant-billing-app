"use client";
import { useEffect, useState } from "react";

type Toast = { id: number; message: string; type: "success" | "error" | "info" };
let toastId = 0;
type Listener = (t: Toast) => void;
const listeners: Listener[] = [];

export function showToast(message: string, type: "success" | "error" | "info" = "success") {
  const toast = { id: ++toastId, message, type };
  listeners.forEach(l => l(toast));
}

const ICONS = { success: "✓", error: "✕", info: "ℹ" };
const COLORS = { success: "#166534", error: "#991B1B", info: "#1E40AF" };

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handler = (t: Toast) => {
      setToasts(prev => [...prev, t]);
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 3500);
    };
    listeners.push(handler);
    return () => { listeners.splice(listeners.indexOf(handler), 1); };
  }, []);

  return (
    <div className="toast-container no-print">
      {toasts.map(t => (
        <div key={t.id} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600,
          background: COLORS[t.type], color: "white",
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          animation: "slideIn 0.25s cubic-bezier(0.34,1.56,0.64,1)"
        }}>
          <span style={{ fontSize: 16, background: "rgba(255,255,255,0.2)", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {ICONS[t.type]}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  );
}
