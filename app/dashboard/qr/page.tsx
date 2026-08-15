"use client";
import { useState, useEffect, useCallback } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type Table = { id: string; number: string; capacity: number };

export default function QRPage() {
  const { tenantId } = useCurrentUser();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/tables");
    const d = await res.json();
    setTables(d.tables ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    setBaseUrl(window.location.origin);
  }, [load]);

  // Embed tenantId in QR URL so /menu page knows which restaurant
  function menuUrl(table: Table) {
    const params = new URLSearchParams({ table: table.number });
    if (tenantId) params.set("tid", tenantId);
    return `${baseUrl}/menu?${params.toString()}`;
  }

  function qrImgUrl(table: Table) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(menuUrl(table))}`;
  }

  async function copyLink(table: Table) {
    await navigator.clipboard.writeText(menuUrl(table));
    setCopied(table.id);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Table QR Codes</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>Scan to order — embed on menus or place on tables</p>
        </div>
        <button className="btn btn-primary no-print" onClick={() => window.print()}>🖨️ Print All</button>
      </div>

      {tables.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📱</div>
          <p>No tables found. Add tables first.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
          {tables.map(table => (
            <div key={table.id} className="card" style={{ padding: 20, textAlign: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 2 }}>Table {table.number}</div>
              <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 12 }}>Capacity: {table.capacity}</div>
              <img src={qrImgUrl(table)} alt={`QR for Table ${table.number}`}
                style={{ width: 180, height: 180, borderRadius: 8, border: "1px solid #E2E8F0" }} />
              <div style={{ fontSize: 10, color: "#CBD5E1", marginTop: 6, wordBreak: "break-all", padding: "0 8px" }}>
                {menuUrl(table).replace(baseUrl, "")}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, justifyContent: "center" }}>
                <button onClick={() => copyLink(table)} className="btn btn-ghost btn-sm no-print"
                  style={{ fontSize: 11 }}>
                  {copied === table.id ? "✅ Copied" : "🔗 Copy Link"}
                </button>
                <a href={qrImgUrl(table)} download={`table-${table.number}-qr.png`}
                  className="btn btn-ghost btn-sm no-print" style={{ fontSize: 11 }}>
                  ⬇️ Save
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
