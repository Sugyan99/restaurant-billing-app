"use client";
import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "ai"; text: string };

const QUICK = [
  { label: "📊 Today's summary", query: "Give me today's sales summary" },
  { label: "🏆 Top items", query: "What are the top selling items this week?" },
  { label: "⏳ Pending orders", query: "How many orders are pending in kitchen?" },
  { label: "📈 Revenue trend", query: "How is revenue trending compared to yesterday?" },
  { label: "💡 Tips", query: "Give me one tip to improve sales today" },
];

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Auto-analyze when chat opens for the first time
  useEffect(() => {
    if (open && !analyzed) {
      setAnalyzed(true);
      autoAnalyze();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function autoAnalyze() {
    setMessages([{ role: "ai", text: "🔍 Analyzing your restaurant data..." }]);
    setLoading(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoAnalyze: true }),
      });
      const data = await res.json();
      setMessages([{ role: "ai", text: data.answer ?? data.error ?? "Unable to analyze. Please try again." }]);
    } catch {
      setMessages([{ role: "ai", text: "Network error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  async function ask(queryOverride?: string) {
    const userMsg = (queryOverride ?? input).trim();
    if (!userMsg || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMsg }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        role: "ai",
        text: data.answer ?? data.error ?? "Something went wrong",
      }]);
    } catch {
      setMessages(prev => [...prev, { role: "ai", text: "Network error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  function handleRefresh() {
    setAnalyzed(false);
    setMessages([]);
    setTimeout(() => {
      setAnalyzed(true);
      autoAnalyze();
    }, 100);
  }

  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 150 }}>
      {open && (
        <div style={{
          width: 340, height: 500, background: "white", borderRadius: 16,
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)", marginBottom: 12,
          display: "flex", flexDirection: "column", overflow: "hidden",
          border: "1px solid #E2E8F0",
        }}>
          {/* Header */}
          <div style={{ background: "linear-gradient(135deg,#0F1623,#1E2D42)", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: "white", fontWeight: 700, fontSize: 14 }}>🤖 AI Assistant</div>
              <div style={{ color: "#94A3B8", fontSize: 11 }}>Powered by Groq · Live data</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleRefresh} title="Refresh analysis"
                style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#94A3B8", cursor: "pointer", fontSize: 14, borderRadius: 6, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
                🔄
              </button>
              <button onClick={handleClose}
                style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#94A3B8", cursor: "pointer", fontSize: 14, borderRadius: 6, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
                ✕
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                background: msg.role === "user" ? "#E8721C" : "#F1F5F9",
                color: msg.role === "user" ? "white" : "#1E293B",
                padding: "9px 13px", borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                fontSize: 13, maxWidth: "88%", lineHeight: 1.55,
              }}>
                {msg.text}
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: "flex-start", background: "#F1F5F9", padding: "9px 13px", borderRadius: "12px 12px 12px 4px", fontSize: 13, color: "#94A3B8", display: "flex", gap: 4, alignItems: "center" }}>
                <span style={{ animation: "pulse 1s ease-in-out infinite" }}>●</span>
                <span style={{ animation: "pulse 1s ease-in-out infinite 0.2s" }}>●</span>
                <span style={{ animation: "pulse 1s ease-in-out infinite 0.4s" }}>●</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick actions */}
          {messages.length <= 1 && !loading && (
            <div style={{ padding: "0 12px 8px", display: "flex", gap: 6, flexWrap: "wrap" }}>
              {QUICK.map(q => (
                <button key={q.label} onClick={() => ask(q.query)}
                  style={{
                    fontSize: 11, padding: "4px 9px", borderRadius: 20,
                    border: "1px solid #E2E8F0", background: "white",
                    cursor: "pointer", color: "#475569", fontWeight: 500,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FFF7ED"; (e.currentTarget as HTMLElement).style.borderColor = "#E8721C"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "white"; (e.currentTarget as HTMLElement).style.borderColor = "#E2E8F0"; }}
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: "8px 12px 12px", display: "flex", gap: 8, borderTop: "1px solid #F1F5F9" }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && ask()}
              placeholder="Ask anything about your restaurant..."
              disabled={loading}
              style={{
                flex: 1, padding: "8px 12px", borderRadius: 8,
                border: "1px solid #E2E8F0", fontSize: 13, outline: "none",
                background: loading ? "#F8FAFC" : "white",
              }}
            />
            <button onClick={() => ask()} disabled={loading || !input.trim()} style={{
              background: loading || !input.trim() ? "#CBD5E1" : "#E8721C",
              color: "white", border: "none", borderRadius: 8,
              padding: "8px 12px", cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              fontSize: 16, transition: "background 0.15s",
            }}>→</button>
          </div>
        </div>
      )}

      {/* Pulse ring when closed */}
      {!open && (
        <div style={{
          position: "absolute", bottom: 0, right: 0,
          width: 52, height: 52, borderRadius: "50%",
          background: "rgba(232,114,28,0.2)",
          animation: "aiPulse 2s ease-in-out infinite",
          pointerEvents: "none",
        }} />
      )}

      <button
        onClick={handleOpen}
        style={{
          width: 52, height: 52, borderRadius: "50%", background: "#E8721C",
          border: "none", cursor: "pointer", fontSize: 22,
          boxShadow: "0 4px 16px rgba(232,114,28,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 0.2s",
          position: "relative",
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = "scale(1.1)"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = "scale(1)"}
      >
        {open ? "✕" : "🤖"}
      </button>

      <style>{`
        @keyframes aiPulse { 0%,100%{transform:scale(1);opacity:.6} 50%{transform:scale(1.4);opacity:0} }
        @keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }
      `}</style>
    </div>
  );
}
