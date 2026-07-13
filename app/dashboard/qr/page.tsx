"use client";
import { useState, useEffect, useCallback } from "react";

type Table = { id: string; number: string; capacity: number };

export default function QRPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    fetch("/api/tables").then(r => r.json()).then(d => setTables(d.tables ?? []));
    setBaseUrl(window.location.origin);
  }, []);

  function getQRUrl(table: Table) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${baseUrl}/menu?table=${table.number}`)}`;
  }

  function printAll() { window.print(); }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Table QR Codes</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>Print and place on each table</p>
        </div>
        <button className="btn btn-primary no-print" onClick={printAll}>🖨️ Print All</button>
      </div>

      {tables.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📱</div>
          <p>No tables found. Add tables first.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
          {tables.map(table => (
            <div key={table.id} className="card" style={{ padding: 20, textAlign: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12 }}>Table {table.number}</div>
              <img
                src={getQRUrl(table)}
                alt={`QR for Table ${table.number}`}
                style={{ width: 160, height: 160, borderRadius: 8 }}
              />
              <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 8 }}>Capacity: {table.capacity}</div>
              <a
                href={getQRUrl(table)}
                download={`table-${table.number}-qr.png`}
                className="btn btn-ghost btn-sm no-print"
                style={{ marginTop: 10, display: "inline-flex", justifyContent: "center" }}
              >
                ⬇️ Download
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
