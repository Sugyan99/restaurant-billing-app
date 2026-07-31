"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallback() {
  const router = useRouter();
  const [msg, setMsg] = useState("Completing sign in…");

  useEffect(() => {
    async function run() {
      // 1. Parse tokens from URL hash (implicit flow)
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash || window.location.search);

      const accessToken  = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const errorParam   = params.get("error_description") ?? params.get("error");

      if (errorParam) {
        router.replace(`/login?error=${encodeURIComponent(errorParam)}`);
        return;
      }

      if (!accessToken || !refreshToken) {
        // Try getSession in case Supabase already stored it
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          router.replace("/login?error=no_tokens");
          return;
        }
        await bridgeToJwt(data.session.access_token);
        return;
      }

      // 2. Set session in Supabase client (stores in cookies)
      const supabase = createClient();
      const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) {
        router.replace(`/login?error=${encodeURIComponent(error.message)}`);
        return;
      }

      // 3. Bridge to JWT so all existing API routes work
      await bridgeToJwt(accessToken);
    }

    async function bridgeToJwt(accessToken: string) {
      setMsg("Setting up your account…");
      const res = await fetch("/api/auth/google-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      });
      if (res.ok) {
        router.replace("/dashboard/home");
      } else {
        const d = await res.json().catch(() => ({}));
        router.replace(`/login?error=${encodeURIComponent(d.error ?? "session_failed")}`);
      }
    }

    run();
  }, [router]);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg,#080d14,#0f1724)", color: "#fff", gap: 16,
    }}>
      <div style={{
        width: 40, height: 40, border: "3px solid rgba(232,114,28,0.3)",
        borderTopColor: "#E8721C", borderRadius: "50%", animation: "spin 0.8s linear infinite",
      }} />
      <p style={{ color: "#94A3B8", fontSize: 15, margin: 0 }}>{msg}</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
