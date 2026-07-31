"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallback() {
  const router = useRouter();
  const [msg, setMsg] = useState("Completing sign in…");

  useEffect(() => {
    const supabase = createClient();

    async function handleCallback() {
      const params = new URLSearchParams(window.location.search);
      const error = params.get("error");
      const errorDesc = params.get("error_description");

      if (error) {
        router.replace(`/login?error=${encodeURIComponent(errorDesc ?? error)}`);
        return;
      }

      // With implicit flow, Supabase puts tokens in the URL hash.
      // detectSessionInUrl:true means getSession() parses them automatically.
      const { data, error: sessionErr } = await supabase.auth.getSession();

      if (sessionErr || !data.session) {
        setMsg("Sign in failed. Redirecting…");
        router.replace(`/login?error=${encodeURIComponent(sessionErr?.message ?? "no_session")}`);
        return;
      }

      // Upsert profile (best-effort)
      try {
        const u = data.session.user;
        await supabase.from("profiles").upsert({
          id: u.id,
          email: u.email ?? "",
          name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email?.split("@")[0] ?? "User",
          avatar_url: u.user_metadata?.avatar_url ?? null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" });
      } catch { /* non-fatal */ }

      router.replace("/dashboard/home");
    }

    handleCallback();
  }, [router]);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg,#080d14,#0f1724)",
      color: "#fff", gap: 16,
    }}>
      <div style={{
        width: 40, height: 40,
        border: "3px solid rgba(232,114,28,0.3)",
        borderTopColor: "#E8721C", borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <p style={{ color: "#94A3B8", fontSize: 15, margin: 0 }}>{msg}</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
