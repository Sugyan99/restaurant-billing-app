"use client";
import { useState, useEffect, useCallback } from "react";
import { showToast } from "@/components/Toast";

type Discount = { id: string; name: string; type: string; value: number; isActive: boolean };

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [name, setName] = useState(""); const [type, setType] = useState("PERCENT"); const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/discounts");
    const data = await res.json();
    setDiscounts(data.discounts ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!name || !value) { showToast("Name and value required", "error"); return; }
    setLoading(true);
    const res = await fetch("/api/discounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, type, value: parseFloat(value) }) });
    if (res.ok) { showToast("Discount added!"); setName(""); setValue(""); await load(); }
    else showToast((await res.json()).error, "error");
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800 }}>Discount Management</h2>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h3 className="card-title">Add Discount</h3></div>
        <div className="card-body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ gridColumn: "1/-1" }}><label className="form-label">Name</label><input className="form-input" placeholder="e.g. Happy Hour, Senior Discount" value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Type</label>
              <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
                <option value="PERCENT">Percentage (%)</option>
                <option value="FLAT">Flat Amount (₹)</option>
              </select>
            </div>
            <div className="form-group"><label className="form-label">Value</label><input className="form-input" type="number" placeholder={type === "PERCENT" ? "10" : "50"} value={value} onChange={e => setValue(e.target.value)} /></div>
          </div>
          <button className="btn btn-primary" onClick={add} disabled={loading}>{loading ? "Adding..." : "Add Discount"}</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3 className="card-title">Active Discounts</h3></div>
        {discounts.length === 0 ? <div style={{ padding: "24px 20px", color: "#94A3B8", fontSize: 13 }}>No discounts yet. Add one above.</div> :
          discounts.map(d => (
            <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid #F1F5F9" }}>
              <div><div style={{ fontWeight: 600 }}>{d.name}</div><div style={{ fontSize: 12, color: "#64748B" }}>{d.type === "PERCENT" ? `${d.value}% off` : `₹${d.value} flat off`}</div></div>
              <span className="badge badge-ready">Active</span>
            </div>
          ))
        }
      </div>
    </div>
  );
}
