"use client";
import { useState, useEffect } from "react";
import { showToast } from "@/components/Toast";

type Settings = {
  id: string; restaurantName: string; address?: string;
  gstNumber?: string; cgstPercent: number; sgstPercent: number; phone?: string;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => setSettings(d.settings));
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
      <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800 }}>Restaurant Settings</h2>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h3 className="card-title">🏪 Restaurant Info</h3></div>
        <div className="card-body">
          <div className="form-group">
            <label className="form-label">Restaurant Name</label>
            <input className="form-input" value={settings.restaurantName}
              onChange={(e) => setSettings({ ...settings, restaurantName: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input className="form-input" placeholder="+91 XXXXX XXXXX" value={settings.phone ?? ""}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <input className="form-input" placeholder="Full restaurant address" value={settings.address ?? ""}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h3 className="card-title">🧾 GST Settings</h3></div>
        <div className="card-body">
          <div className="form-group">
            <label className="form-label">GST Number (GSTIN)</label>
            <input className="form-input" placeholder="22AAAAA0000A1Z5" value={settings.gstNumber ?? ""}
              onChange={(e) => setSettings({ ...settings, gstNumber: e.target.value })} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-group">
              <label className="form-label">CGST %</label>
              <input className="form-input" type="number" step="0.5" value={settings.cgstPercent}
                onChange={(e) => setSettings({ ...settings, cgstPercent: parseFloat(e.target.value) })} />
            </div>
            <div className="form-group">
              <label className="form-label">SGST %</label>
              <input className="form-input" type="number" step="0.5" value={settings.sgstPercent}
                onChange={(e) => setSettings({ ...settings, sgstPercent: parseFloat(e.target.value) })} />
            </div>
          </div>
          <p style={{ fontSize: 12, color: "#94A3B8", margin: "0 0 8px" }}>
            Current total GST: {settings.cgstPercent + settings.sgstPercent}% · Default is 2.5% + 2.5% = 5% for restaurant services
          </p>
        </div>
      </div>

      <button className="btn btn-primary" onClick={save} disabled={loading} style={{ width: "100%", justifyContent: "center", padding: 12 }}>
        {loading ? "Saving..." : "💾 Save Settings"}
      </button>
    </div>
  );
}
