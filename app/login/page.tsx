"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Login failed");
    } else {
      router.push("/dashboard/tables");
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "#0F1623"
    }}>
      <div style={{ width: 360, padding: 32, background: "white", borderRadius: 20 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "#E8721C", display: "inline-flex",
            alignItems: "center", justifyContent: "center", marginBottom: 12
          }}>
            <span style={{ fontSize: 24 }}>🍽️</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0F1623" }}>RestoBill</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748B" }}>Restaurant Billing System</p>
        </div>

        {error && (
          <div style={{
            background: "#FEF2F2", border: "1px solid #FECACA",
            borderRadius: 8, padding: "10px 14px", marginBottom: 16,
            fontSize: 13, color: "#DC2626", fontWeight: 500
          }}>
            {error}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Email Address</label>
          <input
            className="form-input"
            type="email"
            placeholder="owner@restaurant.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Password</label>
          <input
            className="form-input"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
        </div>

        <button
          className="btn btn-primary"
          style={{ width: "100%", justifyContent: "center", padding: "11px 0", fontSize: 14, marginTop: 4 }}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <p style={{ textAlign: "center", fontSize: 12, color: "#94A3B8", marginTop: 20, marginBottom: 0 }}>
          First time? Ask the restaurant owner to set up your account.
        </p>
      </div>
    </div>
  );
}
