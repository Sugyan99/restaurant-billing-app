"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Show error from OAuth redirect
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) setError(decodeURIComponent(err));
  }, []);

  async function handleGoogle() {
    setGoogleLoading(true);
    setError("");
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setGoogleLoading(false);
    }
    // else: browser redirects to Google — keep spinner
  }

  async function handleLogin() {
    if (!email || !password) { setError("Please enter email and password"); return; }
    setLoading(true); setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) setError(data.error ?? "Login failed");
    else router.push("/dashboard/home");
  }

  const cardStyle: React.CSSProperties = {
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(20px)",
    transition: "opacity 0.5s ease, transform 0.5s ease",
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      background: "linear-gradient(135deg, #0F1623 0%, #1A2232 50%, #0F1623 100%)",
    }}>
      {/* Left panel */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ maxWidth: 380, width: "100%", ...cardStyle }}>

          {/* Logo */}
          <div style={{ marginBottom: 32, textAlign: "center" }}>
            <div style={{
              width: 68, height: 68, borderRadius: 20,
              background: "linear-gradient(135deg, #E8721C, #C45A0E)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 32, marginBottom: 14,
              boxShadow: "0 8px 32px rgba(232,114,28,0.45)",
              animation: mounted ? "pulse 3s ease-in-out infinite" : "none",
            }}>🍽️</div>
            <h1 style={{ color: "white", margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>RestoBill</h1>
            <p style={{ color: "#64748B", margin: "6px 0 0", fontSize: 13, fontWeight: 500 }}>Restaurant Management System</p>
          </div>

          {/* Card */}
          <div style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 22,
            padding: "32px 28px",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}>
            <h2 style={{ color: "white", margin: "0 0 22px", fontSize: 17, fontWeight: 700 }}>Sign in to your account</h2>

            {error && (
              <div style={{
                background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.35)",
                borderRadius: 10, padding: "10px 14px", marginBottom: 18,
                fontSize: 13, color: "#FCA5A5", display: "flex", alignItems: "center", gap: 8,
              }}>
                ⚠️ {error}
              </div>
            )}

            {/* Google Button */}
            <button
              onClick={handleGoogle}
              disabled={googleLoading}
              style={{
                width: "100%", padding: "12px 16px", borderRadius: 11,
                border: "1px solid rgba(255,255,255,0.15)",
                background: googleLoading ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.07)",
                color: "white", fontSize: 14, fontWeight: 600,
                cursor: googleLoading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                marginBottom: 20, transition: "all 0.2s",
                boxSizing: "border-box",
              }}
              onMouseEnter={e => { if (!googleLoading) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.12)"; }}
              onMouseLeave={e => { if (!googleLoading) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
            >
              {googleLoading ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                  Redirecting to Google...
                </span>
              ) : (
                <>
                  <GoogleIcon />
                  Continue with Google
                </>
              )}
            </button>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
              <span style={{ fontSize: 11, color: "#3A4A62", fontWeight: 600, letterSpacing: 0.5 }}>OR</span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
            </div>

            {/* Email */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#94A3B8", marginBottom: 6, letterSpacing: 0.5, textTransform: "uppercase" }}>Email Address</label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                type="email"
                placeholder="owner@restaurant.com"
                style={{
                  width: "100%", padding: "11px 14px", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.06)", color: "white",
                  fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border 0.15s",
                }}
                onFocus={e => (e.target.style.borderColor = "#E8721C")}
                onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 22 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#94A3B8", marginBottom: 6, letterSpacing: 0.5, textTransform: "uppercase" }}>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  type={showPwd ? "text" : "password"}
                  placeholder="Enter your password"
                  style={{
                    width: "100%", padding: "11px 44px 11px 14px", borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.06)", color: "white",
                    fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border 0.15s",
                  }}
                  onFocus={e => (e.target.style.borderColor = "#E8721C")}
                  onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                />
                <button
                  onClick={() => setShowPwd(!showPwd)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#64748B" }}
                >
                  {showPwd ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              style={{
                width: "100%", padding: "12px", borderRadius: 10, border: "none",
                background: loading ? "#C45A0E" : "linear-gradient(135deg, #E8721C, #C45A0E)",
                color: "white", fontSize: 14, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.15s", boxShadow: "0 4px 18px rgba(232,114,28,0.45)",
                boxSizing: "border-box",
              }}
            >
              {loading ? "Signing in..." : "Sign In →"}
            </button>
          </div>

          <p style={{ textAlign: "center", fontSize: 12, color: "#3A4A62", marginTop: 16 }}>
            Need access? Contact the restaurant owner.
          </p>
        </div>
      </div>

      {/* Right decorative panel */}
      <div
        id="login-right"
        style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          padding: 60, background: "rgba(232,114,28,0.04)",
          borderLeft: "1px solid rgba(255,255,255,0.04)",
          ...cardStyle,
        }}
        className="no-print"
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 80, marginBottom: 24, filter: "drop-shadow(0 8px 24px rgba(232,114,28,0.3))" }}>🍽️</div>
          <h2 style={{ color: "white", fontSize: 26, fontWeight: 800, margin: "0 0 10px" }}>Complete Restaurant POS</h2>
          <p style={{ color: "#64748B", fontSize: 14, lineHeight: 1.8, maxWidth: 300 }}>
            Tables · Orders · KOT · Billing · GST · Reports · Inventory · AI Assistant
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 28, flexWrap: "wrap" }}>
            {["🪑 Tables", "🧾 GST Billing", "🍳 Kitchen", "📊 Reports", "🤖 AI"].map(f => (
              <span key={f} style={{
                background: "rgba(232,114,28,0.1)", border: "1px solid rgba(232,114,28,0.2)",
                borderRadius: 20, padding: "5px 14px", fontSize: 12, color: "#E8721C", fontWeight: 600,
              }}>{f}</span>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{box-shadow:0 8px 32px rgba(232,114,28,0.45)} 50%{box-shadow:0 8px 48px rgba(232,114,28,0.7)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        #login-right { display: flex; }
        @media(max-width:768px){ #login-right { display: none; } }
      `}</style>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
