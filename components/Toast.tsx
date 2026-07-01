"use client";
import { useEffect, useState } from "react";

type Toast = { id: number; message: string; type: "success" | "error" };
let toastId = 0;
type Listener = (t: Toast) => void;
const listeners: Listener[] = [];

export function showToast(message: string, type: "success" | "error" = "success") {
  const toast = { id: ++toastId, message, type };
  listeners.forEach((l) => l(toast));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handler = (t: Toast) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 3000);
    };
    listeners.push(handler);
    return () => {
      const idx = listeners.indexOf(handler);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }, []);

  return (
    <div className="toast-container no-print">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === "success" ? "✓ " : "✕ "}{t.message}
        </div>
      ))}
    </div>
  );
}
