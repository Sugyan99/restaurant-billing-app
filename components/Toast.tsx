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
const COLORS = { success: "toast-success", error: "toast-error", info: "toast-info" };

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handler = (t: Toast) => {
      setToasts(prev => [...prev, t]);
      // auto remove after a while
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 3500);
    };
    listeners.push(handler);
    return () => { listeners.splice(listeners.indexOf(handler), 1); };
  }, []);

  return (
    // aria-live region so screen readers announce notifications
    <div className="toast-container no-print" aria-live="polite" aria-atomic="true">
      {toasts.map(t => (
        <div
          key={t.id}
          role="status"
          className={`toast show ${COLORS[t.type]}`}
          aria-label={`${t.message}`}
        >
          <span style={{ marginRight: 8, opacity: 0.95 }}>{ICONS[t.type]}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
