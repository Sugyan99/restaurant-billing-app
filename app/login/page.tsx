"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/* ── Ripple hook ── */
function useRipple() {
  const ref = useRef<HTMLButtonElement>(null);
  const trigger = useCallback((e: React.MouseEvent) => {
    const btn = ref.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2.2;
    const span = document.createElement("span");
    span.className = "lb-ripple";
    span.style.width = span.style.height = `${size}px`;
    span.style.left = `${e.clientX - rect.left - size / 2}px`;
    span.style.top = `${e.clientY - rect.top - size / 2}px`;
    btn.appendChild(span);
    span.addEventListener("animationend", () => span.remove(), { once: true });
  }, []);
  return { ref, trigger };
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [success, setSuccess]   = useState(false);
  const [mounted, setMounted]   = useState(false);
  const [emailFocus, setEmailFocus] = useState(false);
  const [pwdFocus,   setPwdFocus]   = useState(false);
  const signInRipple = useRipple();

  useEffect(() => {
    setMounted(true);
    const p = new URLSearchParams(window.location.search);
    const err = p.get("error");
    if (err) setError(decodeURIComponent(err));
  }, []);

  async function handleGoogle() {
    setGLoading(true); setError("");
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (oauthError) { setError(oauthError.message); setGLoading(false); }
  }

  async function handleLogin() {
    if (!email || !password) { setError("Please enter email and password"); return; }
    setLoading(true); setError("");
    const res  = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) { setLoading(false); setError(data.error ?? "Login failed"); }
    else { setSuccess(true); setTimeout(() => router.push("/dashboard/home"), 900); }
  }

  return (
    <div className="lb-root">
      {/* Dot-grid overlay */}
      <div className="lb-grid" />

      {/* Ambient orbs */}
      <div className="lb-orb lb-o1" /><div className="lb-orb lb-o2" /><div className="lb-orb lb-o3" />

      {/* ── LEFT ── */}
      <div className="lb-left">
        <div className={`lb-wrap${mounted ? " lb-in" : ""}`}>

          {/* Logo */}
          <div className="lb-logo-wrap">
            <div className="lb-logo-icon">🍽️</div>
            <h1 className="lb-brand">RestoBill</h1>
            <p className="lb-tagline">Restaurant Management System</p>
          </div>

          {/* Gradient-border card wrapper */}
          <div className={`lb-card-shell${success ? " lb-shell-ok" : ""}`}>
            <div className={`lb-card${success ? " lb-card-ok" : ""}`}>

              <h2 className="lb-card-title">
                {success
                  ? <span className="lb-title-ok"><CheckAnim />Signed in!</span>
                  : "Sign in to your account"}
              </h2>

              {error && <div className="lb-error" key={error}>⚠ {error}</div>}

              {/* Google */}
              <button
                onClick={handleGoogle}
                disabled={gLoading || loading || success}
                className={`lb-google-btn${gLoading ? " lb-busy" : ""}`}
              >
                {gLoading
                  ? <><Spinner />Redirecting to Google…</>
                  : <><GoogleIcon />Continue with Google</>}
              </button>

              {/* Divider */}
              <div className="lb-divider">
                <span className="lb-div-line" /><span className="lb-div-txt">OR</span><span className="lb-div-line" />
              </div>

              {/* Email */}
              <div className={`lb-field${emailFocus ? " lb-field-focus" : ""}`}>
                <label className="lb-label">Email Address</label>
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  onFocus={() => setEmailFocus(true)}
                  onBlur={() => setEmailFocus(false)}
                  type="email" placeholder="owner@restaurant.com"
                  className="lb-input" disabled={loading || success}
                  autoComplete="email"
                />
                <span className="lb-field-bar" />
              </div>

              {/* Password */}
              <div className={`lb-field lb-field-last${pwdFocus ? " lb-field-focus" : ""}`}>
                <label className="lb-label">Password</label>
                <div className="lb-pwd-wrap">
                  <input
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleLogin()}
                    onFocus={() => setPwdFocus(true)}
                    onBlur={() => setPwdFocus(false)}
                    type={showPwd ? "text" : "password"}
                    placeholder="Enter your password"
                    className="lb-input lb-input-pwd"
                    disabled={loading || success} autoComplete="current-password"
                  />
                  <button
                    onClick={() => setShowPwd(v => !v)}
                    className="lb-eye" type="button" tabIndex={-1}
                    aria-label={showPwd ? "Hide password" : "Show password"}
                  >
                    {showPwd ? "🙈" : "👁️"}
                  </button>
                </div>
                <span className="lb-field-bar" />
              </div>

              {/* Sign in */}
              <button
                ref={signInRipple.ref}
                onClick={e => { signInRipple.trigger(e); handleLogin(); }}
                disabled={loading || success}
                className={`lb-signin${loading ? " lb-busy" : ""}${success ? " lb-signin-ok" : ""}`}
              >
                {loading
                  ? <><Spinner />Signing in…</>
                  : success
                  ? "✓ Redirecting…"
                  : "Sign In"}
              </button>
            </div>
          </div>

          <p className="lb-note">Need access? Contact the restaurant owner.</p>
        </div>
      </div>

      {/* ── RIGHT ── */}
      <div className={`lb-right${mounted ? " lb-in" : ""}`} id="login-right">
        <div className="lb-right-inner">
          <div className="lb-right-icon">🍽️</div>
          <h2 className="lb-right-title">Complete Restaurant POS</h2>
          <p className="lb-right-sub">Tables · Orders · KOT · Billing · GST · Reports · Inventory · AI</p>
          <div className="lb-chips">
            {["🪑 Tables","🧾 GST Billing","🍳 Kitchen","📊 Reports","🤖 AI"].map((f,i) => (
              <span key={f} className="lb-chip" style={{ animationDelay:`${0.5+i*0.09}s` }}>{f}</span>
            ))}
          </div>
          <div className="lb-stats">
            {[["99.9%","Uptime"],["< 1s","Load time"],["GST","Ready"]].map(([v,l]) => (
              <div key={l} className="lb-stat">
                <span className="lb-stat-v">{v}</span>
                <span className="lb-stat-l">{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{CSS}</style>
    </div>
  );
}

/* ── Sub-components ── */
function Spinner() {
  return <span className="lb-spinner" aria-hidden="true" />;
}

function CheckAnim() {
  return (
    <svg className="lb-check-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="11" stroke="#4ADE80" strokeWidth="2" className="lb-check-circle" />
      <path d="M7 12.5l3.5 3.5 6.5-7" stroke="#4ADE80" strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round" className="lb-check-mark" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

/* ── All CSS in one constant ── */
const CSS = `
*,*::before,*::after{box-sizing:border-box}

/* Root */
.lb-root{
  min-height:100vh;display:flex;position:relative;overflow:hidden;
  background:linear-gradient(135deg,#080d14 0%,#0f1724 55%,#080d14 100%);
  font-family:'Inter',system-ui,sans-serif;
}

/* Dot grid */
.lb-grid{
  position:absolute;inset:0;pointer-events:none;z-index:0;
  background-image:radial-gradient(rgba(255,255,255,0.045) 1px,transparent 1px);
  background-size:32px 32px;
  mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 40%,transparent 100%);
}

/* Orbs */
.lb-orb{position:absolute;border-radius:50%;filter:blur(90px);pointer-events:none;z-index:0;}
.lb-o1{width:520px;height:520px;top:-140px;left:-120px;background:radial-gradient(circle,rgba(232,114,28,0.14),transparent 70%);animation:oA 13s ease-in-out infinite;}
.lb-o2{width:420px;height:420px;bottom:-100px;right:8%;background:radial-gradient(circle,rgba(99,102,241,0.08),transparent 70%);animation:oB 16s ease-in-out infinite;}
.lb-o3{width:280px;height:280px;top:45%;left:42%;background:radial-gradient(circle,rgba(232,114,28,0.05),transparent 70%);animation:oC 11s ease-in-out infinite;}
@keyframes oA{0%,100%{transform:translate(0,0)}50%{transform:translate(28px,18px)}}
@keyframes oB{0%,100%{transform:translate(0,0)}50%{transform:translate(-18px,-28px)}}
@keyframes oC{0%,100%{transform:translate(0,0)}50%{transform:translate(12px,-12px)}}

/* Layout */
.lb-left{flex:1;display:flex;align-items:center;justify-content:center;padding:40px;position:relative;z-index:1;}
.lb-right{
  flex:1;display:flex;align-items:center;justify-content:center;padding:60px;
  background:rgba(232,114,28,0.025);border-left:1px solid rgba(255,255,255,0.04);
  position:relative;z-index:1;opacity:0;transform:translateX(28px);
  transition:opacity .7s .15s ease,transform .7s .15s ease;
}
.lb-right.lb-in{opacity:1;transform:translateX(0);}
#login-right{display:flex;}
@media(max-width:768px){#login-right{display:none!important;}}

/* Wrap */
.lb-wrap{max-width:390px;width:100%;opacity:0;transform:translateY(28px);transition:opacity .55s ease,transform .55s ease;}
.lb-wrap.lb-in{opacity:1;transform:translateY(0);}

/* Logo */
.lb-logo-wrap{margin-bottom:26px;text-align:center;}
.lb-logo-icon{
  width:72px;height:72px;border-radius:22px;
  background:linear-gradient(135deg,#E8721C,#C45A0E);
  display:inline-flex;align-items:center;justify-content:center;
  font-size:34px;margin-bottom:14px;
  box-shadow:0 8px 32px rgba(232,114,28,0.5);
  animation:logoPulse 3.5s ease-in-out infinite;
  transition:transform .2s ease;cursor:default;
}
.lb-logo-icon:hover{transform:scale(1.07) rotate(-4deg);}
@keyframes logoPulse{
  0%,100%{box-shadow:0 8px 32px rgba(232,114,28,0.45)}
  50%{box-shadow:0 12px 52px rgba(232,114,28,0.7),0 0 0 6px rgba(232,114,28,0.07)}
}
.lb-brand{color:#fff;margin:0;font-size:26px;font-weight:800;letter-spacing:-.6px;}
.lb-tagline{color:#374151;margin:5px 0 0;font-size:13px;font-weight:500;}

/* Gradient border shell */
.lb-card-shell{
  padding:1px;border-radius:25px;
  background:linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0.03) 50%,rgba(232,114,28,0.15));
  transition:background .5s;
}
.lb-card-shell:hover{
  background:linear-gradient(135deg,rgba(232,114,28,0.3),rgba(255,255,255,0.04) 50%,rgba(99,102,241,0.15));
}
.lb-shell-ok{background:linear-gradient(135deg,rgba(34,197,94,0.4),rgba(34,197,94,0.08))!important;}

/* Card */
.lb-card{
  background:rgba(255,255,255,0.045);border-radius:24px;padding:32px 28px;
  backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);
  box-shadow:0 24px 64px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.07);
  position:relative;overflow:hidden;transition:box-shadow .4s;
}
.lb-card-ok{box-shadow:0 24px 64px rgba(0,0,0,0.4),0 0 48px rgba(34,197,94,0.07);}

/* Card title */
.lb-card-title{color:#fff;margin:0 0 20px;font-size:17px;font-weight:700;transition:color .3s;}
.lb-card-ok .lb-card-title{color:#4ADE80;}
.lb-title-ok{display:flex;align-items:center;gap:10px;}

/* Animated check */
.lb-check-svg{width:22px;height:22px;flex-shrink:0;}
.lb-check-circle{stroke-dasharray:69;stroke-dashoffset:69;animation:circleIn .4s ease forwards;}
.lb-check-mark{stroke-dasharray:20;stroke-dashoffset:20;animation:checkIn .3s .35s ease forwards;}
@keyframes circleIn{to{stroke-dashoffset:0}}
@keyframes checkIn{to{stroke-dashoffset:0}}

/* Error */
.lb-error{
  background:rgba(220,38,38,0.12);border:1px solid rgba(220,38,38,0.28);
  border-radius:10px;padding:10px 14px;margin-bottom:16px;
  font-size:13px;color:#FCA5A5;display:flex;align-items:center;gap:8px;
  animation:shake .4s ease;
}
@keyframes shake{0%{transform:translateX(-7px);opacity:0}30%{transform:translateX(5px)}60%{transform:translateX(-3px)}100%{transform:translateX(0);opacity:1}}

/* Google btn */
.lb-google-btn{
  width:100%;padding:12px 16px;border-radius:12px;
  border:1px solid rgba(255,255,255,0.12);
  background:rgba(255,255,255,0.055);
  color:#fff;font-size:14px;font-weight:600;
  cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;
  margin-bottom:20px;transition:background .2s,transform .15s,box-shadow .2s,border-color .2s;
  font-family:inherit;
}
.lb-google-btn:hover:not(:disabled){
  background:rgba(255,255,255,0.1);transform:translateY(-1px);
  box-shadow:0 6px 20px rgba(0,0,0,0.3);border-color:rgba(255,255,255,0.2);
}
.lb-google-btn:active:not(:disabled){transform:scale(0.975);}
.lb-google-btn:disabled{opacity:0.55;cursor:not-allowed;}

/* Divider */
.lb-divider{display:flex;align-items:center;gap:10px;margin-bottom:20px;}
.lb-div-line{flex:1;height:1px;background:rgba(255,255,255,0.07);}
.lb-div-txt{font-size:11px;color:#1F2937;font-weight:700;letter-spacing:.8px;}

/* Field */
.lb-field{margin-bottom:14px;position:relative;}
.lb-field-last{margin-bottom:22px;}
.lb-label{display:block;font-size:11px;font-weight:700;color:#4B5563;margin-bottom:6px;letter-spacing:.6px;text-transform:uppercase;transition:color .2s;}
.lb-field-focus .lb-label{color:#E8721C;}

/* Bottom bar accent */
.lb-field-bar{
  position:absolute;bottom:0;left:0;height:2px;width:0;
  background:linear-gradient(90deg,#E8721C,#F59E0B);border-radius:2px;
  transition:width .3s ease;pointer-events:none;
}
.lb-field-focus .lb-field-bar{width:100%;}

/* Input */
.lb-input{
  width:100%;padding:11px 14px;border-radius:10px;
  border:1px solid rgba(255,255,255,0.09);
  background:rgba(255,255,255,0.05);color:#fff;
  font-size:14px;outline:none;
  transition:border-color .2s,background .2s,box-shadow .2s;
  font-family:inherit;
}
.lb-input::placeholder{color:#1F2937;}
.lb-input:focus{
  border-color:rgba(232,114,28,0.6);
  background:rgba(232,114,28,0.05);
  box-shadow:0 0 0 3px rgba(232,114,28,0.1);
}
.lb-input:disabled{opacity:.45;cursor:not-allowed;}
.lb-input-pwd{padding-right:44px;}
.lb-pwd-wrap{position:relative;}
.lb-eye{
  position:absolute;right:12px;top:50%;transform:translateY(-50%);
  background:none;border:none;cursor:pointer;font-size:15px;color:#374151;
  padding:4px;border-radius:6px;transition:color .15s,transform .2s;line-height:1;
}
.lb-eye:hover{color:#9CA3AF;transform:translateY(-50%) scale(1.18);}

/* Sign-in btn */
.lb-signin{
  width:100%;padding:13px;border-radius:12px;border:none;
  background:linear-gradient(135deg,#E8721C,#C45A0E);
  color:#fff;font-size:14px;font-weight:700;
  cursor:pointer;transition:transform .15s,box-shadow .2s,background .2s,opacity .2s;
  box-shadow:0 4px 20px rgba(232,114,28,0.45);
  display:flex;align-items:center;justify-content:center;gap:8px;
  font-family:inherit;position:relative;overflow:hidden;
}
.lb-signin:hover:not(:disabled){
  transform:translateY(-2px);
  box-shadow:0 10px 32px rgba(232,114,28,0.6);
  background:linear-gradient(135deg,#F07E30,#D4620F);
}
.lb-signin:active:not(:disabled){transform:scale(0.975);box-shadow:0 3px 14px rgba(232,114,28,0.4);}
.lb-signin:disabled{opacity:.72;cursor:not-allowed;}
.lb-signin-ok{background:linear-gradient(135deg,#16A34A,#15803D)!important;box-shadow:0 4px 20px rgba(22,163,74,0.45)!important;}

/* Ripple */
.lb-ripple{
  position:absolute;border-radius:50%;
  background:rgba(255,255,255,0.22);
  transform:scale(0);animation:ripple .5s ease-out;
  pointer-events:none;
}
@keyframes ripple{to{transform:scale(1);opacity:0}}

/* Spinner */
.lb-spinner{
  width:15px;height:15px;
  border:2px solid rgba(255,255,255,0.22);border-top-color:#fff;
  border-radius:50%;animation:spin .65s linear infinite;
  display:inline-block;flex-shrink:0;
}
@keyframes spin{to{transform:rotate(360deg)}}

/* Note */
.lb-note{text-align:center;font-size:12px;color:#1F2937;margin-top:14px;}

/* Right panel */
.lb-right-inner{text-align:center;max-width:340px;}
.lb-right-icon{
  font-size:72px;margin-bottom:20px;
  filter:drop-shadow(0 8px 24px rgba(232,114,28,0.35));
  display:inline-block;animation:floatY 4s ease-in-out infinite;
}
@keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
.lb-right-title{color:#fff;font-size:24px;font-weight:800;margin:0 0 10px;letter-spacing:-.4px;}
.lb-right-sub{color:#374151;font-size:14px;line-height:1.8;margin:0 0 28px;}

/* Chips */
.lb-chips{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:32px;}
.lb-chip{
  background:rgba(232,114,28,0.09);border:1px solid rgba(232,114,28,0.17);
  border-radius:20px;padding:5px 14px;font-size:12px;color:#E8721C;font-weight:600;
  opacity:0;animation:chipIn .5s ease forwards;
  transition:background .2s,transform .15s;cursor:default;
}
.lb-chip:hover{background:rgba(232,114,28,0.18);transform:translateY(-2px);}
@keyframes chipIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

/* Stats */
.lb-stats{display:flex;border:1px solid rgba(255,255,255,0.06);border-radius:14px;overflow:hidden;}
.lb-stat{flex:1;padding:14px 8px;text-align:center;border-right:1px solid rgba(255,255,255,0.06);}
.lb-stat:last-child{border-right:none;}
.lb-stat-v{display:block;color:#fff;font-size:15px;font-weight:800;letter-spacing:-.3px;}
.lb-stat-l{display:block;color:#1F2937;font-size:10px;font-weight:600;margin-top:2px;text-transform:uppercase;letter-spacing:.5px;}
`;
