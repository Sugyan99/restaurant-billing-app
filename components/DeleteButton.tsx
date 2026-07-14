"use client";
import { useState } from "react";
import { showToast } from "@/components/Toast";

interface Props {
  url: string;
  onDeleted: () => void;
  label?: string;
  confirmMsg?: string;
}

export function DeleteButton({ url, onDeleted, label = "Delete", confirmMsg }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function doDelete() {
    setLoading(true);
    try {
      const res = await fetch(url, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      showToast("Deleted successfully");
      onDeleted();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Delete failed", "error");
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#DC2626", fontWeight: 600 }}>
          {confirmMsg ?? "Sure?"}
        </span>
        <button className="btn btn-danger btn-sm" onClick={doDelete} disabled={loading} style={{ padding: "2px 8px", fontSize: 11 }}>
          {loading ? "..." : "Yes"}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)} style={{ padding: "2px 8px", fontSize: 11 }}>
          No
        </button>
      </span>
    );
  }

  return (
    <button
      className="btn btn-danger btn-sm"
      onClick={() => setConfirming(true)}
      style={{ padding: "4px 8px", fontSize: 11 }}
    >
      🗑️ {label}
    </button>
  );
}
