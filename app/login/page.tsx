"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) { setError("Please enter email and password"); return; }
    setLoading(true); setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) setError(data.error ?? "Login failed");
    else router.push("/dashboard/home");
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "linear-gradient(135deg, #0F1623 0%, #1A2232 50%, #0F1623 100%)" }}>
      {/* Left panel */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ maxWidth: 360, width: "100%" }}>
          {/* Logo */}
          <div style={{ marginBottom: 36, textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, #E8721C, #C45A0E)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 30, marginBottom: 16, boxShadow: "0 8px 24px rgba(232,114,28,0.4)" }}>
              🍽️
            </div>
            <h1 style={{ color: "white", margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>RestoBill</h1>
            <p style={{ color: "#64748B", margin: "6px 0 0", fontSize: 14 }}>Restaurant Management System</p>
          </div>

          {/* Card */}
          <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 32, backdropFilter: "blur(10px)" }}>
            <h2 style={{ color: "white", margin: "0 0 24px", fontSize: 18, fontWeight: 700 }}>Sign in to your account</h2>

            {error && (
              <div style={{ background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#FCA5A5", display: "flex", alignItems: "center", gap: 8 }}>
                ⚠️ {error}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#94A3B8", marginBottom: 6 }}>Email Address</label>
              <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} type="email" placeholder="owner@restaurant.com"
                style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", color: "white", fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border 0.15s" }}
                onFocus={e => e.target.style.borderColor = "#E8721C"}
                onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#94A3B8", marginBottom: 6 }}>Password</label>
              <div style={{ position: "relative" }}>
                <input value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} type={showPwd ? "text" : "password"} placeholder="Enter your password"
                  style={{ width: "100%", padding: "11px 44px 11px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", color: "white", fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border 0.15s" }}
                  onFocus={e => e.target.style.borderColor = "#E8721C"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                />
                <button onClick={() => setShowPwd(!showPwd)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#64748B" }}>
                  {showPwd ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <button onClick={handleLogin} disabled={loading} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: loading ? "#C45A0E" : "linear-gradient(135deg, #E8721C, #C45A0E)", color: "white", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", transition: "all 0.15s", boxShadow: "0 4px 14px rgba(232,114,28,0.4)" }}>
              {loading ? "Signing in..." : "Sign In →"}
            </button>
          </div>

          <p style={{ textAlign: "center", fontSize: 12, color: "#3A4A62", marginTop: 20 }}>
            Need an account? Contact the restaurant owner.
          </p>
        </div>
      </div>

      {/* Right panel - decorative */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 60, background: "rgba(232,114,28,0.04)", borderLeft: "1px solid rgba(255,255,255,0.04)" }} className="no-print" id="login-right">
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 80, marginBottom: 24 }}>🍽️</div>
          <h2 style={{ color: "white", fontSize: 28, fontWeight: 800, margin: "0 0 12px" }}>Complete Restaurant POS</h2>
          <p style={{ color: "#64748B", fontSize: 15, lineHeight: 1.8, maxWidth: 320 }}>
            Tables · Orders · KOT · Billing · GST · Reports · Inventory · AI Assistant
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 32, flexWrap: "wrap" }}>
            {["🪑 Table Management", "🧾 GST Billing", "🍳 Kitchen View", "📊 Reports", "🤖 AI Assistant"].map(f => (
              <span key={f} style={{ background: "rgba(232,114,28,0.1)", border: "1px solid rgba(232,114,28,0.2)", borderRadius: 20, padding: "5px 14px", fontSize: 12, color: "#E8721C", fontWeight: 600 }}>{f}</span>
            ))}
          </div>
        </div>
      </div>

      <style>{`#login-right { display: flex; } @media(max-width:768px){#login-right{display:none;}}`}</style>
    </div>
  );
}
