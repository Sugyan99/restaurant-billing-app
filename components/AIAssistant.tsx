"use client";
import { useState } from "react";

type Message = { role: "user" | "ai"; text: string };

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", text: "Namaste! Main aapka restaurant AI assistant hu. Koi bhi sales, menu, ya billing ke baare mein poochh sakte ho! 🍽️" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMsg }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: data.answer ?? data.error ?? "Something went wrong" },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: "ai", text: "Network error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 150 }}>
      {/* Chat window */}
      {open && (
        <div style={{
          width: 320, height: 420, background: "white", borderRadius: 16,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)", marginBottom: 12,
          display: "flex", flexDirection: "column", overflow: "hidden",
          border: "1px solid #E2E8F0"
        }}>
          {/* Header */}
          <div style={{ background: "#0F1623", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: "white", fontWeight: 700, fontSize: 14 }}>🤖 AI Assistant</div>
              <div style={{ color: "#94A3B8", fontSize: 11 }}>Powered by Groq</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                background: msg.role === "user" ? "#E8721C" : "#F1F5F9",
                color: msg.role === "user" ? "white" : "#1E293B",
                padding: "8px 12px", borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                fontSize: 13, maxWidth: "85%", lineHeight: 1.5
              }}>
                {msg.text}
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: "flex-start", background: "#F1F5F9", padding: "8px 12px", borderRadius: "12px 12px 12px 4px", fontSize: 13, color: "#94A3B8" }}>
                Soch raha hu...
              </div>
            )}
          </div>

          {/* Suggestions */}
          <div style={{ padding: "0 12px 8px", display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["Aaj ki sale?", "Top items?", "Pending bills?"].map((s) => (
              <button key={s} onClick={() => { setInput(s); }} style={{
                fontSize: 11, padding: "3px 8px", borderRadius: 20, border: "1px solid #E2E8F0",
                background: "white", cursor: "pointer", color: "#64748B"
              }}>{s}</button>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding: "8px 12px 12px", display: "flex", gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
              placeholder="Kuch bhi poochho..."
              style={{
                flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #E2E8F0",
                fontSize: 13, outline: "none"
              }}
            />
            <button onClick={ask} disabled={loading || !input.trim()} style={{
              background: "#E8721C", color: "white", border: "none",
              borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 16
            }}>→</button>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: 52, height: 52, borderRadius: "50%", background: "#E8721C",
          border: "none", cursor: "pointer", fontSize: 22,
          boxShadow: "0 4px 16px rgba(232,114,28,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 0.2s"
        }}
      >
        {open ? "✕" : "🤖"}
      </button>
    </div>
  );
}
