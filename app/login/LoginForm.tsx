"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Invalid email or password.",
  no_tokens: "Sign-in could not be completed. Please try again.",
  session_failed: "Sign-in could not be completed. Please try again.",
};

function safeErrorFromUrl() {
  const value = new URLSearchParams(window.location.search).get("error");
  if (!value) return "";
  return ERROR_MESSAGES[value] ?? "Sign-in could not be completed. Please try again.";
}

export default function LoginForm() {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setError(safeErrorFromUrl());
    emailRef.current?.focus();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || googleLoading || success) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setError("");

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ email: normalizedEmail, password }),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(response.status === 429 ? "Too many sign-in attempts. Please wait and try again." : "Invalid email or password.");
        return;
      }

      if (!data?.user?.id) {
        setError("Sign-in could not be completed. Please try again.");
        return;
      }

      setSuccess(true);
      router.replace("/dashboard/home");
      router.refresh();
    } catch (err) {
      setError(err instanceof DOMException && err.name === "AbortError" ? "The sign-in request timed out. Check your connection and try again." : "Unable to reach the sign-in service. Check your connection and try again.");
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (loading || googleLoading || success) return;
    setGoogleLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (oauthError) setError("Google sign-in could not be started. Please try again.");
    } catch {
      setError("Google sign-in could not be started. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <main className="lb-root">
      <div className="lb-grid" aria-hidden="true" />
      <div className="lb-orb lb-o1" aria-hidden="true" />
      <div className="lb-orb lb-o2" aria-hidden="true" />
      <div className="lb-orb lb-o3" aria-hidden="true" />

      <section className="lb-left" aria-labelledby="login-title">
        <div className="lb-wrap">
          <header className="lb-logo-wrap">
            <div className="lb-logo-icon" aria-hidden="true">🍽️</div>
            <p className="lb-brand">RestoBill</p>
            <p className="lb-tagline">Restaurant Management System</p>
          </header>

          <div className="lb-card-shell">
            <div className="lb-card">
              <h1 id="login-title" className="lb-card-title">Sign in to your account</h1>
              <p className="lb-card-subtitle">Use your restaurant staff account to continue.</p>

              <div className="lb-status-slot" aria-live="polite" aria-atomic="true">
                {error && <div className="lb-error" role="alert">⚠ <span>{error}</span></div>}
                {success && <div className="lb-success" role="status">✓ Signed in. Redirecting…</div>}
              </div>

              <button type="button" onClick={handleGoogle} disabled={loading || googleLoading || success} className="lb-google-btn">
                {googleLoading ? <><Spinner />Redirecting to Google…</> : <><GoogleIcon />Continue with Google</>}
              </button>

              <div className="lb-divider" aria-hidden="true"><span /><b>OR</b><span /></div>

              <form onSubmit={handleSubmit} noValidate>
                <div className="lb-field">
                  <label className="lb-label" htmlFor="login-email">Email address</label>
                  <input
                    ref={emailRef}
                    id="login-email"
                    name="email"
                    className="lb-input"
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="username"
                    placeholder="owner@restaurant.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={Boolean(error)}
                    disabled={loading || success}
                  />
                </div>

                <div className="lb-field lb-field-last">
                  <label className="lb-label" htmlFor="login-password">Password</label>
                  <div className="lb-pwd-wrap">
                    <input
                      id="login-password"
                      name="password"
                      className="lb-input lb-input-pwd"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      aria-invalid={Boolean(error)}
                      disabled={loading || success}
                    />
                    <button type="button" className="lb-eye" onClick={() => setShowPassword((value) => !value)} disabled={loading || success} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
                      {showPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading || googleLoading || success} className="lb-signin">
                  {loading ? <><Spinner />Signing in…</> : success ? "Redirecting…" : "Sign In"}
                </button>
              </form>
            </div>
          </div>
          <p className="lb-note">Need access? Contact the restaurant owner.</p>
        </div>
      </section>

      <aside className="lb-right" aria-label="RestoBill features">
        <div className="lb-right-inner">
          <div className="lb-right-icon" aria-hidden="true">🍽️</div>
          <h2 className="lb-right-title">Complete Restaurant POS</h2>
          <p className="lb-right-sub">Tables · Orders · KOT · Billing · GST · Reports · Inventory · AI</p>
          <div className="lb-chips">{["🪑 Tables", "🧾 GST Billing", "🍳 Kitchen", "📊 Reports", "🤖 AI"].map((feature) => <span className="lb-chip" key={feature}>{feature}</span>)}</div>
          <div className="lb-stats"><div><strong>99.9%</strong><span>Uptime</span></div><div><strong>&lt; 1s</strong><span>Load target</span></div><div><strong>GST</strong><span>Ready</span></div></div>
        </div>
      </aside>

      <style>{CSS}</style>
    </main>
  );
}

function Spinner() { return <span className="lb-spinner" aria-hidden="true" />; }

function GoogleIcon() {
  return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/><path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>;
}

const CSS = `
*,*::before,*::after{box-sizing:border-box}
.lb-root{min-height:100svh;display:flex;position:relative;overflow:hidden;background:linear-gradient(135deg,#080d14 0%,#0f1724 55%,#080d14 100%);font-family:Inter,system-ui,sans-serif;color:#fff}
.lb-grid{position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(rgba(255,255,255,.045) 1px,transparent 1px);background-size:32px 32px;mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 40%,transparent 100%)}
.lb-orb{position:absolute;border-radius:50%;filter:blur(90px);pointer-events:none}.lb-o1{width:520px;height:520px;top:-140px;left:-120px;background:radial-gradient(circle,rgba(232,114,28,.14),transparent 70%);animation:oA 13s ease-in-out infinite}.lb-o2{width:420px;height:420px;bottom:-100px;right:8%;background:radial-gradient(circle,rgba(99,102,241,.08),transparent 70%);animation:oB 16s ease-in-out infinite}.lb-o3{width:280px;height:280px;top:45%;left:42%;background:radial-gradient(circle,rgba(232,114,28,.05),transparent 70%);animation:oC 11s ease-in-out infinite}
@keyframes oA{0%,100%{transform:translate(0,0)}50%{transform:translate(28px,18px)}}@keyframes oB{0%,100%{transform:translate(0,0)}50%{transform:translate(-18px,-28px)}}@keyframes oC{0%,100%{transform:translate(0,0)}50%{transform:translate(12px,-12px)}}
.lb-left{flex:1;display:flex;align-items:center;justify-content:center;padding:32px;position:relative;z-index:1}.lb-wrap{width:min(100%,390px)}
.lb-logo-wrap{text-align:center;margin-bottom:24px}.lb-logo-icon{width:68px;height:68px;border-radius:20px;background:linear-gradient(135deg,#E8721C,#C45A0E);display:inline-flex;align-items:center;justify-content:center;font-size:32px;margin-bottom:12px;box-shadow:0 8px 32px rgba(232,114,28,.45)}.lb-brand{margin:0;font-size:26px;font-weight:800;letter-spacing:-.6px}.lb-tagline{margin:5px 0 0;color:#64748B;font-size:13px;font-weight:500}
.lb-card-shell{padding:1px;border-radius:24px;background:linear-gradient(135deg,rgba(255,255,255,.1),rgba(255,255,255,.03) 50%,rgba(232,114,28,.15))}.lb-card{border-radius:23px;background:rgba(12,18,28,.96);padding:28px;box-shadow:0 24px 80px rgba(0,0,0,.28)}.lb-card-title{margin:0;font-size:22px;font-weight:800;letter-spacing:-.4px}.lb-card-subtitle{margin:7px 0 18px;color:#64748B;font-size:13px;line-height:1.5}.lb-status-slot{min-height:0;margin-bottom:10px}.lb-error,.lb-success{display:flex;gap:8px;align-items:flex-start;border-radius:10px;padding:10px 12px;font-size:12px;line-height:1.45}.lb-error{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);color:#FCA5A5}.lb-success{background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.25);color:#86EFAC}
.lb-google-btn,.lb-signin{width:100%;min-height:46px;border:0;border-radius:12px;font:inherit;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:9px;transition:transform .15s ease,opacity .15s ease,box-shadow .15s ease}.lb-google-btn{background:#fff;color:#111827;border:1px solid #E5E7EB}.lb-signin{margin-top:16px;background:linear-gradient(135deg,#E8721C,#C45A0E);color:#fff;box-shadow:0 8px 24px rgba(232,114,28,.25)}.lb-google-btn:hover:not(:disabled),.lb-signin:hover:not(:disabled){transform:translateY(-1px)}button:disabled{cursor:not-allowed;opacity:.65}.lb-divider{display:flex;align-items:center;gap:10px;margin:18px 0;color:#475569;font-size:10px}.lb-divider span{height:1px;background:#1E293B;flex:1}.lb-divider b{font-weight:700}
.lb-field{margin-top:14px}.lb-field-last{margin-top:16px}.lb-label{display:block;margin-bottom:7px;color:#CBD5E1;font-size:12px;font-weight:700}.lb-input{width:100%;height:46px;border-radius:10px;border:1px solid #263244;background:#0B111B;color:#fff;padding:0 13px;font:inherit;font-size:14px;outline:none;transition:border-color .15s,box-shadow .15s}.lb-input::placeholder{color:#475569}.lb-input:focus{border-color:#E8721C;box-shadow:0 0 0 3px rgba(232,114,28,.14)}.lb-pwd-wrap{position:relative}.lb-input-pwd{padding-right:46px}.lb-eye{position:absolute;right:4px;top:4px;width:38px;height:38px;border:0;background:transparent;color:#94A3B8;border-radius:8px;cursor:pointer;font-size:17px}.lb-eye:focus-visible{outline:2px solid #E8721C;outline-offset:1px}.lb-spinner{width:16px;height:16px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;display:inline-block;animation:spin .7s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
.lb-note{text-align:center;color:#475569;font-size:11px;margin:14px 0 0}.lb-right{flex:1;display:flex;align-items:center;justify-content:center;padding:60px;background:rgba(232,114,28,.025);border-left:1px solid rgba(255,255,255,.04);position:relative;z-index:1}.lb-right-inner{max-width:500px;text-align:center}.lb-right-icon{font-size:52px;margin-bottom:18px}.lb-right-title{font-size:32px;margin:0 0 10px;letter-spacing:-1px}.lb-right-sub{color:#64748B;line-height:1.6;font-size:14px}.lb-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin:24px 0}.lb-chip{padding:8px 11px;border:1px solid rgba(255,255,255,.08);border-radius:999px;color:#CBD5E1;background:rgba(255,255,255,.025);font-size:11px}.lb-stats{display:flex;justify-content:center;gap:42px;margin-top:30px}.lb-stats div{display:flex;flex-direction:column;gap:3px}.lb-stats strong{font-size:17px}.lb-stats span{font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:.5px}
@media(max-width:768px){.lb-root{overflow:auto}.lb-left{padding:20px 14px;min-height:100svh}.lb-right{display:none}.lb-card{padding:22px}.lb-card-title{font-size:20px}.lb-logo-icon{width:60px;height:60px;font-size:28px}.lb-orb{filter:blur(70px)}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
`;
