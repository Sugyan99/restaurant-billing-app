"use client";
import { useState, useEffect } from "react";
import { showToast } from "@/components/Toast";

type Settings = {
  id: string; restaurantName: string; address?: string; gstNumber?: string;
  cgstPercent: number; sgstPercent: number; phone?: string;
  email?: string; website?: string; currency: string; openingCash: number;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"restaurant"|"gst"|"cash">("restaurant");

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(d => setSettings(d.settings));
  }, []);

  async function save() {
    if (!settings) return;
    setLoading(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setLoading(false);
    if (res.ok) showToast("Settings saved!");
    else showToast("Failed to save", "error");
  }

  if (!settings) return <div style={{ padding: 40, color: "#94A3B8" }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 600 }}>
      <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800 }}>Settings</h2>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["restaurant","gst","cash"] as const).map(t => (
          <button key={t} className={`btn btn-sm ${tab === t ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab(t)}>
            {t === "restaurant" ? "🏪 Restaurant" : t === "gst" ? "🧾 GST" : "💵 Cash"}
          </button>
        ))}
      </div>

      {tab === "restaurant" && (
        <div className="card">
          <div className="card-header"><h3 className="card-title">Restaurant Info</h3></div>
          <div className="card-body">
            {[
              ["Restaurant Name", "restaurantName", "text", "My Restaurant"],
              ["Phone", "phone", "tel", "+91 XXXXX XXXXX"],
              ["Email", "email", "email", "restaurant@email.com"],
              ["Website", "website", "url", "www.myrestaurant.com"],
              ["Address", "address", "text", "Full address"],
            ].map(([label, key, type, placeholder]) => (
              <div className="form-group" key={key}>
                <label className="form-label">{label}</label>
                <input className="form-input" type={type} placeholder={placeholder}
                  value={(settings as Record<string, unknown>)[key] as string ?? ""}
                  onChange={e => setSettings({ ...settings, [key]: e.target.value })} />
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "gst" && (
        <div className="card">
          <div className="card-header"><h3 className="card-title">GST Configuration</h3></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">GSTIN</label>
              <input className="form-input" placeholder="22AAAAA0000A1Z5" value={settings.gstNumber ?? ""}
                onChange={e => setSettings({ ...settings, gstNumber: e.target.value })} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">CGST %</label>
                <input className="form-input" type="number" step="0.5" value={settings.cgstPercent}
                  onChange={e => setSettings({ ...settings, cgstPercent: parseFloat(e.target.value) })} />
              </div>
              <div className="form-group">
                <label className="form-label">SGST %</label>
                <input className="form-input" type="number" step="0.5" value={settings.sgstPercent}
                  onChange={e => setSettings({ ...settings, sgstPercent: parseFloat(e.target.value) })} />
              </div>
            </div>
            <div style={{ background: "#F0FDF4", borderRadius: 8, padding: 12, fontSize: 13, color: "#16A34A", fontWeight: 600 }}>
              Total GST: {(settings.cgstPercent + settings.sgstPercent).toFixed(1)}% — Standard restaurant rate is 5% (2.5+2.5)
            </div>
          </div>
        </div>
      )}

      {tab === "cash" && (
        <div className="card">
          <div className="card-header"><h3 className="card-title">Cash Drawer</h3></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Receipt Header Message</label>
              <input className="form-input" placeholder="Thank you for your visit!" value={settings.receiptHeader ?? ""}
                onChange={e => setSettings({ ...settings, receiptHeader: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Receipt Footer Message</label>
              <input className="form-input" placeholder="Visit us again soon!" value={settings.receiptFooter ?? ""}
                onChange={e => setSettings({ ...settings, receiptFooter: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Opening Cash (₹)</label>
              <input className="form-input" type="number" step="0.01" value={settings.openingCash}
                onChange={e => setSettings({ ...settings, openingCash: parseFloat(e.target.value) })} />
              <p style={{ fontSize: 12, color: "#94A3B8", margin: "4px 0 0" }}>
                Amount kept in cash drawer at start of each day
              </p>
            </div>
          </div>
        </div>
      )}

      <button className="btn btn-primary" onClick={save} disabled={loading}
        style={{ width: "100%", justifyContent: "center", padding: 12, marginTop: 16 }}>
        {loading ? "Saving..." : "💾 Save Settings"}
      </button>
    </div>
  );
}
