"use client";
import { useState, useEffect } from "react";
import { showToast } from "@/components/Toast";
import { PageTabs } from "@/components/PageTabs";
import QRPage from "@/app/dashboard/qr/page";

type Settings = {
  id: string; restaurantName: string; address?: string; gstNumber?: string;
  cgstPercent: number; sgstPercent: number; phone?: string;
  email?: string; website?: string; currency: string; openingCash: number;
  receiptHeader?: string; receiptFooter?: string; taxMode?: string;
  isIGST?: boolean; igstPercent?: number;
  groqApiKey?: string; groqModel?: string; aiEnabled?: boolean;
};

export default function SettingsPage() {
  return (
    <PageTabs tabs={[
      { id: "settings", label: "Restaurant Settings", icon: "⚙️" },
      { id: "qr",       label: "Table QR Codes",      icon: "📱" },
    ]}>
      {tab => tab === "qr" ? <QRPage /> : <SettingsContent />}
    </PageTabs>
  );
}

function SettingsContent() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"restaurant"|"gst"|"cash"|"ai">("restaurant");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);

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

  async function testAI() {
    setTesting(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "Say hello in one sentence." }),
      });
      const data = await res.json();
      if (data.answer) showToast("✅ AI connected: " + data.answer.slice(0, 60));
      else showToast("❌ " + (data.error ?? "AI not responding"), "error");
    } catch {
      showToast("❌ Network error", "error");
    } finally {
      setTesting(false);
    }
  }

  if (!settings) return <div style={{ padding: 40, color: "#94A3B8" }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 600 }}>
      <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800 }}>Settings</h2>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {(["restaurant","gst","cash","ai"] as const).map(t => (
          <button key={t} className={`btn btn-sm ${tab === t ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab(t)}>
            {t === "restaurant" ? "🏪 Restaurant" : t === "gst" ? "🧾 GST" : t === "cash" ? "💵 Cash" : "🤖 AI Assistant"}
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

      {tab === "ai" && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">🤖 AI Assistant Configuration</h3>
          </div>
          <div className="card-body">
            {/* Enable toggle */}
            <div className="form-group" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <label className="form-label" style={{ marginBottom: 2 }}>Enable AI Assistant</label>
                <p style={{ fontSize: 12, color: "#94A3B8", margin: 0 }}>Show the 🤖 chat button on all pages</p>
              </div>
              <div
                onClick={() => setSettings({ ...settings, aiEnabled: !settings.aiEnabled })}
                style={{
                  width: 44, height: 24, borderRadius: 12, cursor: "pointer", transition: "background 0.2s",
                  background: settings.aiEnabled !== false ? "#E8721C" : "#CBD5E1",
                  position: "relative", flexShrink: 0,
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", background: "white",
                  position: "absolute", top: 2, transition: "left 0.2s",
                  left: settings.aiEnabled !== false ? 22 : 2,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }} />
              </div>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid #F1F5F9", margin: "16px 0" }} />

            {/* Groq API Key */}
            <div className="form-group">
              <label className="form-label">Groq API Key</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="form-input"
                  type={showKey ? "text" : "password"}
                  placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxxxx"
                  value={settings.groqApiKey ?? ""}
                  onChange={e => setSettings({ ...settings, groqApiKey: e.target.value })}
                  style={{ flex: 1, fontFamily: "monospace" }}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(s => !s)}
                  className="btn btn-ghost btn-sm"
                  style={{ flexShrink: 0 }}
                >
                  {showKey ? "🙈" : "👁️"}
                </button>
              </div>
              <p style={{ fontSize: 12, color: "#94A3B8", margin: "4px 0 0" }}>
                Free key from{" "}
                <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer"
                  style={{ color: "#E8721C", textDecoration: "none" }}>
                  console.groq.com/keys
                </a>{" "}
                — 14,400 requests/day free
              </p>
            </div>

            {/* Model selector */}
            <div className="form-group">
              <label className="form-label">AI Model</label>
              <select
                className="form-input"
                value={settings.groqModel ?? "llama3-8b-8192"}
                onChange={e => setSettings({ ...settings, groqModel: e.target.value })}
              >
                <option value="llama3-8b-8192">Llama 3 8B — Fast (recommended)</option>
                <option value="llama3-70b-8192">Llama 3 70B — Smarter, slower</option>
                <option value="mixtral-8x7b-32768">Mixtral 8x7B — Balanced</option>
                <option value="gemma2-9b-it">Gemma 2 9B — Efficient</option>
              </select>
            </div>

            {/* Test button */}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={testAI}
              disabled={testing}
              style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
            >
              {testing ? "Testing..." : "🧪 Test AI Connection"}
            </button>

            <div style={{ background: "#FFF7ED", border: "1px solid #FDBA74", borderRadius: 8, padding: 12, fontSize: 12, color: "#92400E", marginTop: 12 }}>
              <strong>Note:</strong> The API key is stored securely in your database. If you also set <code>GROQ_API_KEY</code> in Vercel env vars, that takes priority.
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
