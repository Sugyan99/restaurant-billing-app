"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/* ── Ripple ── */
function useRipple() {
  const ref = useRef<HTMLButtonElement>(null);
  const trigger = useCallback((e: React.MouseEvent) => {
    const btn = ref.current; if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2.2;
    const span = document.createElement("span");
    span.className = "lb-ripple";
    span.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px`;
    btn.appendChild(span);
    span.addEventListener("animationend", () => span.remove(), { once: true });
  }, []);
  return { ref, trigger };
}

/* ── 3D Tilt ── */
function use3DTilt(intensity = 10) {
  const ref = useRef<HTMLDivElement>(null);
  const move = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * intensity;
    const y = ((e.clientY - r.top) / r.height - 0.5) * -intensity;
    el.style.transform = `perspective(920px) rotateY(${x}deg) rotateX(${y}deg) scale3d(1.018,1.018,1.018)`;
    el.style.transition = `transform 0.08s ease`;
  }, [intensity]);
  const leave = useCallback(() => {
    if (!ref.current) return;
    ref.current.style.transition = `transform 0.5s cubic-bezier(0.2,0.9,0.2,1)`;
    ref.current.style.transform = `perspective(920px) rotateY(0deg) rotateX(0deg) scale3d(1,1,1)`;
  }, []);
  return { ref, move, leave };
}

/* ── Typewriter ── */
function Typewriter({ texts }: { texts: string[] }) {
  const [idx, setIdx] = useState(0);
  const [chars, setChars] = useState(0);
  const [del, setDel] = useState(false);
  useEffect(() => {
    const cur = texts[idx];
    const t = setTimeout(() => {
      if (!del && chars < cur.length) { setChars(c => c + 1); }
      else if (!del && chars === cur.length) { setTimeout(() => setDel(true), 1600); }
      else if (del && chars > 0) { setChars(c => c - 1); }
      else { setDel(false); setIdx(i => (i + 1) % texts.length); }
    }, del ? 38 : 72);
    return () => clearTimeout(t);
  }, [chars, del, idx, texts]);
  return <span className="lb-type">{texts[idx].slice(0, chars)}<span className="lb-cursor">|</span></span>;
}

/* ── Counter ── */
function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      let start = 0;
      const step = Math.ceil(to / 60);
      const t = setInterval(() => {
        start = Math.min(start + step, to);
        setVal(start);
        if (start >= to) clearInterval(t);
      }, 20);
    });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [to]);
  return <span ref={ref}>{val}{suffix}</span>;
}

/* ── Floating particles ── */
const FOOD = ["🍕","🍔","🍜","🥗","🍛","🍱","🥩","🍰","☕","🥐","🍣","🧆"];
function Particles() {
  const items = useRef(
    Array.from({ length: 14 }, (_, i) => ({
      icon: FOOD[i % FOOD.length],
      x: Math.random() * 100,
      y: Math.random() * 100,
      dur: 12 + Math.random() * 10,
      delay: -Math.random() * 20,
      size: 14 + Math.random() * 12,
    }))
  );
  return (
    <div className="lb-particles" aria-hidden="true">
      {items.current.map((p, i) => (
        <span key={i} className="lb-particle" style={{
          left: `${p.x}%`, top: `${p.y}%`,
          fontSize: `${p.size}px`,
          animationDuration: `${p.dur}s`,
          animationDelay: `${p.delay}s`,
        }}>{p.icon}</span>
      ))}
    </div>
  );
}

/* ── Beams ── */
function Beams() {
  return (
    <svg className="lb-beams" viewBox="0 0 900 900" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="b1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E8721C" stopOpacity="0"/>
          <stop offset="50%" stopColor="#E8721C" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#E8721C" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="b2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#6366F1" stopOpacity="0"/>
          <stop offset="50%" stopColor="#6366F1" stopOpacity="0.1"/>
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <line x1="0" y1="200" x2="900" y2="700" stroke="url(#b1)" strokeWidth="1.5" className="lb-beam lb-beam1"/>
      <line x1="0" y1="500" x2="900" y2="100" stroke="url(#b2)" strokeWidth="1" className="lb-beam lb-beam2"/>
      <line x1="200" y1="0" x2="700" y2="900" stroke="url(#b1)" strokeWidth="1" className="lb-beam lb-beam3"/>
    </svg>
  );
}

/* ── 3D Geometric Background ── */
const GEO = ["⬡","◈","⬟","◆","⬠","⭓","⬣","◉"];
function ThreeDBg() {
  const items = useRef(
    Array.from({ length: 12 }, (_, i) => ({
      shape: GEO[i % GEO.length],
      x: 4 + Math.random() * 92,
      y: 4 + Math.random() * 92,
      dur: 16 + Math.random() * 16,
      delay: -Math.random() * 30,
      size: 14 + Math.random() * 34,
      opacity: 0.025 + Math.random() * 0.055,
      color: i % 3 === 0 ? "#E8721C" : i % 3 === 1 ? "#6366F1" : "#F59E0B",
    }))
  );
  return (
    <div className="lb-3dbg" aria-hidden="true">
      {items.current.map((p, i) => (
        <span key={i} className="lb-3dshape" style={{
          left: `${p.x}%`, top: `${p.y}%`,
          fontSize: `${p.size}px`, opacity: p.opacity, color: p.color,
          animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`,
        }}>{p.shape}</span>
      ))}
    </div>
  );
}

const TYPED = ["Tables & Orders","GST Billing","Kitchen Display","Staff & Shifts","Sales Reports","Inventory Control"];
const FEATURES = [
  { icon: "🪑", label: "Smart Tables" },
  { icon: "🧾", label: "GST Billing" },
  { icon: "🍳", label: "Live KDS" },
  { icon: "📊", label: "Analytics" },
  { icon: "🤖", label: "AI Insights" },
  { icon: "📱", label: "Mobile POS" },
];

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
  const [pwdFocus, setPwdFocus]     = useState(false);
  const signInRipple = useRipple();
  const tilt = use3DTilt();

  useEffect(() => {
    setMounted(true);
    const err = new URLSearchParams(window.location.search).get("error");
    if (err) setError(decodeURIComponent(err));
  }, []);

  async function handleGoogle() {
    setGLoading(true); setError("");
    const { error: e } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { access_type: "offline", prompt: "consent" } },
    });
    if (e) { setError(e.message); setGLoading(false); }
  }

  async function handleLogin() {
    if (!email || !password) { setError("Please enter email and password"); return; }
    setLoading(true); setError("");
    const res  = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await res.json();
    if (!res.ok) { setLoading(false); setError(data.error ?? "Login failed"); }
    else { setSuccess(true); setTimeout(() => router.push("/dashboard/home"), 900); }
  }

  return (
    <div className="lb-root">
      <div className="lb-grid" />
      <Beams />
      <Particles />
      <ThreeDBg />
      <div className="lb-orb lb-o1" /><div className="lb-orb lb-o2" /><div className="lb-orb lb-o3" />

      {/* ── LEFT ── */}
      <div className="lb-left">
        <div className={`lb-wrap${mounted ? " lb-in" : ""}`}>

          <div className="lb-logo-wrap">
            <div className="lb-logo-ring lb-logo-3d">
              <div className="lb-logo-icon lb-logo-icon-3d">🍽️</div>
            </div>
            <h1 className="lb-brand">RestoBill</h1>
            <p className="lb-tagline">Restaurant Management System</p>
          </div>

          <div ref={tilt.ref} className="lb-tilt-wrap" onMouseMove={tilt.move} onMouseLeave={tilt.leave}>
          <div className={`lb-card-shell${success ? " lb-shell-ok" : ""}`}>
            <div className={`lb-card${success ? " lb-card-ok" : ""}`}>
              <div className="lb-card-glow" />

              <h2 className="lb-card-title">
                {success
                  ? <span className="lb-title-ok"><CheckAnim />Signed in!</span>
                  : "Sign in to your account"}
              </h2>

              {error && <div className="lb-error" key={error}>⚠ {error}</div>}

              <button onClick={handleGoogle} disabled={gLoading || loading || success} className={`lb-google-btn${gLoading ? " lb-busy" : ""}`}>
                {gLoading ? <><Spin />Redirecting…</> : <><GoogleIcon />Continue with Google</>}
              </button>

              <div className="lb-divider">
                <span className="lb-div-line" /><span className="lb-div-txt">OR</span><span className="lb-div-line" />
              </div>

              <div className={`lb-field${emailFocus ? " lb-field-focus" : ""}`}>
                <label className="lb-label">Email Address</label>
                <div className="lb-input-wrap">
                  <span className="lb-input-icon">✉</span>
                  <input value={email} onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleLogin()}
                    onFocus={() => setEmailFocus(true)} onBlur={() => setEmailFocus(false)}
                    type="email" placeholder="owner@restaurant.com"
                    className="lb-input lb-input-ic" disabled={loading || success} autoComplete="email" />
                </div>
                <span className="lb-field-bar" />
              </div>

              <div className={`lb-field lb-field-last${pwdFocus ? " lb-field-focus" : ""}`}>
                <label className="lb-label">Password</label>
                <div className="lb-pwd-wrap lb-input-wrap">
                  <span className="lb-input-icon">🔒</span>
                  <input value={password} onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleLogin()}
                    onFocus={() => setPwdFocus(true)} onBlur={() => setPwdFocus(false)}
                    type={showPwd ? "text" : "password"} placeholder="Enter your password"
                    className="lb-input lb-input-ic lb-input-pwd"
                    disabled={loading || success} autoComplete="current-password" />
                  <button onClick={() => setShowPwd(v => !v)} className="lb-eye" type="button" tabIndex={-1}>
                    {showPwd ? "🙈" : "👁️"}
                  </button>
                </div>
                <span className="lb-field-bar" />
              </div>

              <button ref={signInRipple.ref}
                onClick={e => { signInRipple.trigger(e); handleLogin(); }}
                disabled={loading || success}
                className={`lb-signin${loading ? " lb-busy" : ""}${success ? " lb-signin-ok" : ""}`}>
                {loading ? <><Spin />Signing in…</> : success ? "✓ Redirecting…" : <><span className="lb-btn-arrow">→</span> Sign In</>}
              </button>
            </div>
          </div>
          </div>{/* /tilt-wrap */}
          <p className="lb-note">Need access? Contact the restaurant owner.</p>
        </div>
      </div>

      {/* ── RIGHT ── */}
      <div className={`lb-right${mounted ? " lb-in" : ""}`} id="login-right">
        <div className="lb-right-inner">
          <div className="lb-badge">✦ Next-Gen POS</div>
          <h2 className="lb-right-title">
            Manage your<br/>
            <Typewriter texts={TYPED} />
          </h2>
          <p className="lb-right-sub">Complete restaurant ERP with real-time KDS,<br/>GST billing, and AI-powered insights.</p>

          <div className="lb-feat-grid">
            {FEATURES.map((f, i) => (
              <div key={f.label} className="lb-feat lb-feat-3d" style={{ animationDelay: `${0.4 + i * 0.08}s` }}>
                <span className="lb-feat-icon">{f.icon}</span>
                <span className="lb-feat-label">{f.label}</span>
              </div>
            ))}
          </div>

          <div className="lb-stats-wrap">
            <div className="lb-stat-card">
              <span className="lb-stat-v"><Counter to={99} suffix=".9%" /></span>
              <span className="lb-stat-l">Uptime</span>
            </div>
            <div className="lb-stat-card">
              <span className="lb-stat-v"><Counter to={30} /></span>
              <span className="lb-stat-l">Clients</span>
            </div>
            <div className="lb-stat-card">
              <span className="lb-stat-v">GST</span>
              <span className="lb-stat-l">Ready</span>
            </div>
          </div>

          <div className="lb-trust">
            <span className="lb-trust-dot" /><span>Secured with end-to-end encryption</span>
          </div>
        </div>
      </div>

      <style>{CSS}</style>
    </div>
  );
}

function Spin() { return <span className="lb-spinner" aria-hidden="true" />; }

function CheckAnim() {
  return (
    <svg className="lb-check-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="11" stroke="#4ADE80" strokeWidth="2" className="lb-check-circle" />
      <path d="M7 12.5l3.5 3.5 6.5-7" stroke="#4ADE80" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="lb-check-mark" />
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

const CSS = `
*,*::before,*::after{box-sizing:border-box}

.lb-root{
  min-height:100vh;display:flex;position:relative;overflow:hidden;
  background:linear-gradient(135deg,#060b11 0%,#0d1520 55%,#060b11 100%);
  font-family:'Inter',system-ui,sans-serif;
}

/* Grid */
.lb-grid{
  position:absolute;inset:0;pointer-events:none;z-index:0;
  background-image:
    linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px);
  background-size:52px 52px;
  mask-image:radial-gradient(ellipse 90% 90% at 50% 50%,black 30%,transparent 100%);
}

/* Beams */
.lb-beams{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;}
.lb-beam{stroke-dasharray:600;stroke-dashoffset:600;}
.lb-beam1{animation:beamSlide 6s ease-in-out infinite;}
.lb-beam2{animation:beamSlide 9s 2s ease-in-out infinite reverse;}
.lb-beam3{animation:beamSlide 7s 1s ease-in-out infinite;}
@keyframes beamSlide{0%,100%{stroke-dashoffset:600;opacity:0}30%{opacity:1}70%{opacity:1}100%{stroke-dashoffset:-600;opacity:0}}

/* Particles */
.lb-particles{position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden;}
.lb-particle{
  position:absolute;opacity:0;
  animation:floatParticle linear infinite;
  filter:blur(0.3px);
}
@keyframes floatParticle{
  0%{transform:translateY(30px) scale(0.6);opacity:0}
  10%{opacity:0.18}
  90%{opacity:0.10}
  100%{transform:translateY(-80px) scale(0.9) rotate(20deg);opacity:0}
}

/* Orbs */
.lb-orb{position:absolute;border-radius:50%;filter:blur(100px);pointer-events:none;z-index:0;}
.lb-o1{width:600px;height:600px;top:-180px;left:-150px;background:radial-gradient(circle,rgba(232,114,28,0.13),transparent 70%);animation:oA 14s ease-in-out infinite;}
.lb-o2{width:480px;height:480px;bottom:-120px;right:5%;background:radial-gradient(circle,rgba(99,102,241,0.09),transparent 70%);animation:oB 18s ease-in-out infinite;}
.lb-o3{width:320px;height:320px;top:40%;left:45%;background:radial-gradient(circle,rgba(232,114,28,0.06),transparent 70%);animation:oC 12s ease-in-out infinite;}
@keyframes oA{0%,100%{transform:translate(0,0)}50%{transform:translate(32px,20px)}}
@keyframes oB{0%,100%{transform:translate(0,0)}50%{transform:translate(-22px,-30px)}}
@keyframes oC{0%,100%{transform:translate(0,0)}50%{transform:translate(14px,-14px)}}

/* Layout */
.lb-left{flex:1;display:flex;align-items:center;justify-content:center;padding:40px;position:relative;z-index:1;}
.lb-right{
  flex:1;display:flex;align-items:center;justify-content:center;padding:60px;
  background:rgba(232,114,28,0.018);border-left:1px solid rgba(255,255,255,0.035);
  position:relative;z-index:1;opacity:0;transform:translateX(30px);
  transition:opacity .7s .2s ease,transform .7s .2s ease;
}
.lb-right.lb-in{opacity:1;transform:translateX(0);}
#login-right{display:flex;}
@media(max-width:768px){#login-right{display:none!important;}}

/* Wrap */
.lb-wrap{max-width:400px;width:100%;opacity:0;transform:translateY(30px);transition:opacity .6s ease,transform .6s ease;}
.lb-wrap.lb-in{opacity:1;transform:translateY(0);}

/* Logo */
.lb-logo-wrap{margin-bottom:28px;text-align:center;}
.lb-logo-ring{
  display:inline-block;padding:3px;border-radius:28px;margin-bottom:14px;
  background:conic-gradient(from 0deg,#E8721C,#F59E0B,#6366F1,#E8721C);
  animation:spinRing 6s linear infinite;
}
.lb-logo-icon{
  width:72px;height:72px;border-radius:24px;
  background:linear-gradient(135deg,#1a2436,#0d1520);
  display:flex;align-items:center;justify-content:center;
  font-size:36px;position:relative;
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.08);
  transition:transform .3s ease;cursor:default;
}
.lb-logo-ring:hover .lb-logo-icon{transform:scale(1.06);}
@keyframes spinRing{to{transform:rotate(360deg)}}
.lb-brand{color:#fff;margin:0;font-size:28px;font-weight:800;letter-spacing:-.8px;}
.lb-tagline{color:#2D3748;margin:5px 0 0;font-size:13px;font-weight:500;letter-spacing:.2px;}

/* Card shell */
.lb-card-shell{
  padding:1.5px;border-radius:26px;
  background:linear-gradient(145deg,rgba(255,255,255,0.1),rgba(255,255,255,0.03) 40%,rgba(232,114,28,0.2));
  transition:background .5s;position:relative;
}
.lb-card-shell:hover{background:linear-gradient(145deg,rgba(232,114,28,0.35),rgba(255,255,255,0.03) 50%,rgba(99,102,241,0.18));}
.lb-shell-ok{background:linear-gradient(145deg,rgba(34,197,94,0.45),rgba(34,197,94,0.06))!important;}

/* Card */
.lb-card{
  background:rgba(255,255,255,0.04);border-radius:24px;padding:32px 28px;
  backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);
  box-shadow:0 28px 72px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.08);
  position:relative;overflow:hidden;transition:box-shadow .4s;
}
.lb-card-glow{
  position:absolute;top:-80px;right:-80px;width:200px;height:200px;
  background:radial-gradient(circle,rgba(232,114,28,0.08),transparent 70%);
  pointer-events:none;border-radius:50%;
  animation:glowPulse 4s ease-in-out infinite;
}
@keyframes glowPulse{0%,100%{opacity:0.6;transform:scale(1)}50%{opacity:1;transform:scale(1.2)}}
.lb-card-ok{box-shadow:0 28px 72px rgba(0,0,0,0.4),0 0 56px rgba(34,197,94,0.06);}

.lb-card-title{color:#fff;margin:0 0 20px;font-size:17px;font-weight:700;transition:color .3s;}
.lb-card-ok .lb-card-title{color:#4ADE80;}
.lb-title-ok{display:flex;align-items:center;gap:10px;}

/* SVG check */
.lb-check-svg{width:22px;height:22px;flex-shrink:0;}
.lb-check-circle{stroke-dasharray:69;stroke-dashoffset:69;animation:circleIn .4s ease forwards;}
.lb-check-mark{stroke-dasharray:20;stroke-dashoffset:20;animation:checkIn .3s .35s ease forwards;}
@keyframes circleIn{to{stroke-dashoffset:0}}
@keyframes checkIn{to{stroke-dashoffset:0}}

/* Error */
.lb-error{
  background:rgba(220,38,38,0.1);border:1px solid rgba(220,38,38,0.25);
  border-radius:10px;padding:10px 14px;margin-bottom:16px;
  font-size:13px;color:#FCA5A5;display:flex;align-items:center;gap:8px;
  animation:shake .4s ease;
}
@keyframes shake{0%{transform:translateX(-7px);opacity:0}30%{transform:translateX(5px)}60%{transform:translateX(-3px)}100%{transform:translateX(0);opacity:1}}

/* Google */
.lb-google-btn{
  width:100%;padding:12px 16px;border-radius:13px;
  border:1px solid rgba(255,255,255,0.1);
  background:rgba(255,255,255,0.05);
  color:#fff;font-size:14px;font-weight:600;
  cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;
  margin-bottom:20px;transition:all .2s;font-family:inherit;
}
.lb-google-btn:hover:not(:disabled){
  background:rgba(255,255,255,0.09);transform:translateY(-1px);
  box-shadow:0 6px 24px rgba(0,0,0,0.3);border-color:rgba(255,255,255,0.18);
}
.lb-google-btn:active:not(:disabled){transform:scale(0.978);}
.lb-google-btn:disabled{opacity:.5;cursor:not-allowed;}

/* Divider */
.lb-divider{display:flex;align-items:center;gap:10px;margin-bottom:20px;}
.lb-div-line{flex:1;height:1px;background:rgba(255,255,255,0.06);}
.lb-div-txt{font-size:11px;color:#1F2937;font-weight:700;letter-spacing:.8px;}

/* Field */
.lb-field{margin-bottom:14px;position:relative;}
.lb-field-last{margin-bottom:22px;}
.lb-label{display:block;font-size:11px;font-weight:700;color:#4B5563;margin-bottom:7px;letter-spacing:.6px;text-transform:uppercase;transition:color .2s;}
.lb-field-focus .lb-label{color:#E8721C;}
.lb-field-bar{position:absolute;bottom:0;left:0;height:2px;width:0;background:linear-gradient(90deg,#E8721C,#F59E0B);border-radius:2px;transition:width .3s ease;pointer-events:none;}
.lb-field-focus .lb-field-bar{width:100%;}

/* Input wrap with icon */
.lb-input-wrap{position:relative;display:flex;align-items:center;}
.lb-input-icon{position:absolute;left:12px;font-size:14px;pointer-events:none;opacity:.35;z-index:1;}
.lb-input{
  width:100%;padding:11px 14px;border-radius:11px;
  border:1px solid rgba(255,255,255,0.08);
  background:rgba(255,255,255,0.045);color:#fff;
  font-size:14px;outline:none;transition:all .2s;font-family:inherit;
}
.lb-input-ic{padding-left:36px;}
.lb-input::placeholder{color:#1F2937;}
.lb-input:focus{
  border-color:rgba(232,114,28,0.55);
  background:rgba(232,114,28,0.05);
  box-shadow:0 0 0 3px rgba(232,114,28,0.09);
}
.lb-input:disabled{opacity:.4;cursor:not-allowed;}
.lb-input-pwd{padding-right:44px;}
.lb-pwd-wrap{position:relative;}
.lb-eye{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:15px;color:#374151;padding:4px;border-radius:6px;transition:color .15s,transform .2s;line-height:1;}
.lb-eye:hover{color:#9CA3AF;transform:translateY(-50%) scale(1.18);}

/* Sign-in btn */
.lb-signin{
  width:100%;padding:13px;border-radius:13px;border:none;
  background:linear-gradient(135deg,#E8721C,#C45A0E);
  color:#fff;font-size:15px;font-weight:700;
  cursor:pointer;transition:transform .15s,box-shadow .2s,background .2s;
  box-shadow:0 4px 24px rgba(232,114,28,0.5);
  display:flex;align-items:center;justify-content:center;gap:8px;
  font-family:inherit;position:relative;overflow:hidden;letter-spacing:.2px;
}
.lb-btn-arrow{font-size:18px;transition:transform .2s;}
.lb-signin:hover:not(:disabled) .lb-btn-arrow{transform:translateX(4px);}
.lb-signin:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 12px 36px rgba(232,114,28,0.65);background:linear-gradient(135deg,#F07E30,#D4620F);}
.lb-signin:active:not(:disabled){transform:scale(0.977);}
.lb-signin:disabled{opacity:.72;cursor:not-allowed;}
.lb-signin-ok{background:linear-gradient(135deg,#16A34A,#15803D)!important;box-shadow:0 4px 24px rgba(22,163,74,0.5)!important;}

/* Ripple */
.lb-ripple{position:absolute;border-radius:50%;background:rgba(255,255,255,0.22);transform:scale(0);animation:ripple .55s ease-out;pointer-events:none;}
@keyframes ripple{to{transform:scale(1);opacity:0}}

/* Spinner */
.lb-spinner{width:15px;height:15px;border:2px solid rgba(255,255,255,0.2);border-top-color:#fff;border-radius:50%;animation:spin .65s linear infinite;display:inline-block;flex-shrink:0;}
@keyframes spin{to{transform:rotate(360deg)}}

/* Note */
.lb-note{text-align:center;font-size:12px;color:#1F2937;margin-top:14px;}

/* ── RIGHT PANEL ── */
.lb-right-inner{text-align:center;max-width:360px;width:100%;}

.lb-badge{
  display:inline-flex;align-items:center;gap:6px;
  background:rgba(232,114,28,0.12);border:1px solid rgba(232,114,28,0.25);
  border-radius:20px;padding:5px 14px;font-size:11px;font-weight:700;
  color:#E8721C;letter-spacing:.6px;text-transform:uppercase;margin-bottom:22px;
  animation:badgeIn .6s .3s ease both;
}
@keyframes badgeIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}

.lb-right-title{
  color:#fff;font-size:30px;font-weight:800;margin:0 0 14px;
  letter-spacing:-.8px;line-height:1.2;
  animation:fadeUp .6s .4s ease both;
}
.lb-type{color:#E8721C;}
.lb-cursor{display:inline-block;color:#E8721C;animation:blink .8s step-end infinite;}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}

.lb-right-sub{
  color:#374151;font-size:14px;line-height:1.75;margin:0 0 30px;
  animation:fadeUp .6s .5s ease both;
}

/* Feature grid */
.lb-feat-grid{
  display:grid;grid-template-columns:repeat(3,1fr);gap:10px;
  margin-bottom:28px;
}
.lb-feat{
  background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.06);
  border-radius:14px;padding:14px 8px;display:flex;flex-direction:column;
  align-items:center;gap:6px;cursor:default;
  opacity:0;animation:featIn .5s ease forwards;
  transition:background .2s,transform .2s,border-color .2s;
}
.lb-feat:hover{background:rgba(232,114,28,0.08);border-color:rgba(232,114,28,0.22);transform:translateY(-3px);}
@keyframes featIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.lb-feat-icon{font-size:22px;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.4));}
.lb-feat-label{font-size:11px;font-weight:700;color:#6B7280;letter-spacing:.3px;}

/* Stats */
.lb-stats-wrap{display:flex;border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;margin-bottom:20px;animation:fadeUp .6s .8s ease both;}
.lb-stat-card{flex:1;padding:16px 8px;text-align:center;border-right:1px solid rgba(255,255,255,0.06);}
.lb-stat-card:last-child{border-right:none;}
.lb-stat-v{display:block;color:#fff;font-size:18px;font-weight:800;letter-spacing:-.4px;}
.lb-stat-l{display:block;color:#1F2937;font-size:10px;font-weight:700;margin-top:3px;text-transform:uppercase;letter-spacing:.6px;}

/* Trust */
.lb-trust{display:flex;align-items:center;justify-content:center;gap:8px;font-size:12px;color:#374151;animation:fadeUp .6s .9s ease both;}
.lb-trust-dot{width:7px;height:7px;background:#22C55E;border-radius:50%;box-shadow:0 0 6px #22C55E;animation:dotPulse 2s ease-in-out infinite;}
@keyframes dotPulse{0%,100%{box-shadow:0 0 6px #22C55E}50%{box-shadow:0 0 12px #22C55E,0 0 24px rgba(34,197,94,0.3)}}

@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}

/* ═══════════ 3D GLASSMORPHISM UPGRADES ═══════════ */

/* 3D Geometric BG */
.lb-3dbg{position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden;}
.lb-3dshape{
  position:absolute;line-height:1;
  animation:float3d linear infinite;
  will-change:transform,opacity;
}
@keyframes float3d{
  0%  {transform:perspective(600px) translateZ(-30px) translateY(0)   rotate(0deg)  scale(0.7);opacity:0}
  8%  {opacity:1}
  50% {transform:perspective(600px) translateZ( 20px) translateY(-40px) rotate(180deg) scale(1.1)}
  92% {opacity:0.7}
  100%{transform:perspective(600px) translateZ(-30px) translateY(-80px) rotate(360deg) scale(0.7);opacity:0}
}

/* Tilt wrapper */
.lb-tilt-wrap{transform-style:preserve-3d;will-change:transform;}

/* Card shell 3D depth layers via pseudo */
.lb-card-shell::before{
  content:'';position:absolute;inset:0;border-radius:26px;
  background:linear-gradient(135deg,rgba(255,255,255,0.07) 0%,transparent 55%);
  pointer-events:none;z-index:1;
}
.lb-card-shell::after{
  content:'';position:absolute;inset:-1px;border-radius:27px;
  background:linear-gradient(225deg,rgba(232,114,28,0.15) 0%,transparent 50%,rgba(99,102,241,0.08) 100%);
  pointer-events:none;z-index:0;
}

/* 3D inner card shine layer */
.lb-card::after{
  content:'';position:absolute;top:0;left:0;right:0;height:40%;
  background:linear-gradient(180deg,rgba(255,255,255,0.055) 0%,transparent 100%);
  border-radius:24px 24px 0 0;pointer-events:none;
}

/* 3D Logo */
.lb-logo-3d{animation:spinRing 6s linear infinite,logoFloat3d 8s ease-in-out infinite;}
@keyframes logoFloat3d{
  0%,100%{filter:drop-shadow(0 4px 16px rgba(232,114,28,0.3))}
  50%    {filter:drop-shadow(0 8px 32px rgba(232,114,28,0.55))}
}
.lb-logo-icon-3d{
  box-shadow:
    0  6px 18px rgba(0,0,0,0.4),
    0  2px  6px rgba(0,0,0,0.3),
    inset 0 1px 0 rgba(255,255,255,0.12),
    inset 0 -2px 6px rgba(0,0,0,0.2);
  transition:box-shadow .3s,transform .3s;
}
.lb-logo-ring:hover .lb-logo-icon-3d{
  transform:scale(1.06) perspective(200px) rotateY(15deg);
  box-shadow:0 12px 32px rgba(232,114,28,0.4),inset 0 1px 0 rgba(255,255,255,0.15);
}

/* 3D Feature cards */
.lb-feat-3d{
  position:relative;
  box-shadow:0 4px 12px rgba(0,0,0,0.18),0 1px 3px rgba(0,0,0,0.12);
  transform-style:preserve-3d;
}
.lb-feat-3d::before{
  content:'';position:absolute;inset:0;border-radius:14px;
  background:linear-gradient(135deg,rgba(255,255,255,0.06) 0%,transparent 60%);
  pointer-events:none;
}
.lb-feat-3d:hover{
  transform:perspective(400px) translateZ(10px) translateY(-5px) !important;
  box-shadow:0 16px 36px rgba(0,0,0,0.28),0 4px 12px rgba(0,0,0,0.15),0 0 0 1px rgba(232,114,28,0.3);
  background:rgba(232,114,28,0.1);border-color:rgba(232,114,28,0.28);
}
.lb-feat-3d .lb-feat-icon{
  transition:transform .3s ease,filter .3s ease;
  display:inline-block;
}
.lb-feat-3d:hover .lb-feat-icon{
  transform:perspective(200px) translateZ(8px) scale(1.2);
  filter:drop-shadow(0 4px 10px rgba(232,114,28,0.5));
}

/* 3D Stats cards */
.lb-stat-card{
  position:relative;transition:background .2s,transform .2s;transform-style:preserve-3d;
}
.lb-stat-card:hover{
  background:rgba(232,114,28,0.06);
  transform:perspective(300px) translateZ(6px);
}

/* 3D Google btn depth */
.lb-google-btn{
  box-shadow:0 4px 16px rgba(0,0,0,0.18),inset 0 1px 0 rgba(255,255,255,0.07);
  transition:all .2s,box-shadow .2s;
}
.lb-google-btn:hover:not(:disabled){
  box-shadow:0 8px 28px rgba(0,0,0,0.28),inset 0 1px 0 rgba(255,255,255,0.1);
}

/* 3D Sign-in button depth */
.lb-signin{
  box-shadow:
    0 4px 24px rgba(232,114,28,0.5),
    0 2px  8px rgba(0,0,0,0.2),
    inset 0 1px 0 rgba(255,255,255,0.18),
    inset 0 -2px 4px rgba(0,0,0,0.15);
}
.lb-signin:hover:not(:disabled){
  box-shadow:
    0 12px 36px rgba(232,114,28,0.65),
    0  4px 16px rgba(0,0,0,0.25),
    inset 0 1px 0 rgba(255,255,255,0.22),
    inset 0 -2px 4px rgba(0,0,0,0.12);
}

/* 3D Input depth */
.lb-input:focus{
  box-shadow:
    0 0 0 3px rgba(232,114,28,0.09),
    0 2px 8px rgba(0,0,0,0.12),
    inset 0 2px 4px rgba(0,0,0,0.06);
}

/* 3D Right panel badge */
.lb-badge{
  box-shadow:0 4px 16px rgba(232,114,28,0.2),inset 0 1px 0 rgba(255,255,255,0.08);
  backdrop-filter:blur(8px);
}

/* 3D Stats wrap */
.lb-stats-wrap{
  background:rgba(255,255,255,0.02);
  box-shadow:0 4px 24px rgba(0,0,0,0.2),inset 0 1px 0 rgba(255,255,255,0.05);
  backdrop-filter:blur(12px);
}
`;
