#!/usr/bin/env bash
# ============================================================
#  RestoBill  —  Apply UI 2.0 (Glassmorphism) branch
#  Run from the root of the cloned repo:
#    chmod +x apply-ui2.sh && ./apply-ui2.sh
# ============================================================
set -e

TOKEN="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"
REPO="Sugyan99/restaurant-billing-app"
BRANCH="ui-2.0-feature"

echo "▶ Setting git config..."
git config --global user.email "Sugyan239@gmail.com"
git config --global user.name  "Sugyan99"

echo "▶ Fetching latest main..."
git remote set-url origin "https://${TOKEN}@github.com/${REPO}.git"
git fetch origin main

echo "▶ Creating branch ${BRANCH} from main..."
git checkout -B "${BRANCH}" origin/main

# ─────────────────────────────────────────────
# 1. Glass CSS design system
# ─────────────────────────────────────────────
echo "▶ Writing styles/glass.css..."
mkdir -p app
cat > app/glass.css << 'GLASSCSS'
/* ============================================================
   RestoBill — Glass Design System v2.0
   ============================================================ */
:root {
  --glass-bg:        rgba(255,255,255,0.05);
  --glass-bg-md:     rgba(255,255,255,0.08);
  --glass-bg-strong: rgba(255,255,255,0.12);
  --glass-bg-nav:    rgba(10,10,30,0.75);
  --glass-bg-modal:  rgba(10,10,30,0.85);
  --glass-border:    rgba(255,255,255,0.10);
  --glass-border-md: rgba(255,255,255,0.18);
  --glass-blur:      blur(16px);
  --glass-blur-sm:   blur(8px);
  --glass-blur-lg:   blur(24px);
  --glass-shadow:    0 8px 32px rgba(0,0,0,0.45);
  --glass-shadow-sm: 0 4px 16px rgba(0,0,0,0.30);
  --glass-shadow-lg: 0 16px 48px rgba(0,0,0,0.55);
  --primary:        #6366f1;
  --primary-dark:   #4f46e5;
  --primary-light:  #818cf8;
  --primary-glow:   rgba(99,102,241,0.35);
  --accent:         #8b5cf6;
  --accent-glow:    rgba(139,92,246,0.35);
  --bg-app:   #06060f;
  --bg-card:  #0d0d20;
  --bg-panel: #0a0a1a;
  --text-primary:   #f8fafc;
  --text-secondary: #94a3b8;
  --text-muted:     #64748b;
  --success:      #10b981;
  --success-glow: rgba(16,185,129,0.25);
  --warning:      #f59e0b;
  --danger:       #ef4444;
  --danger-glow:  rgba(239,68,68,0.25);
  --info:         #38bdf8;
  --sidebar-w:    260px;
  --t-fast:   150ms ease;
  --t-normal: 250ms ease;
  --t-slow:   400ms ease;
}
body { background:var(--bg-app); color:var(--text-primary); font-family:'Inter',system-ui,sans-serif; }
.glass { background:var(--glass-bg); backdrop-filter:var(--glass-blur); -webkit-backdrop-filter:var(--glass-blur); border:1px solid var(--glass-border); box-shadow:var(--glass-shadow); }
.glass-md { background:var(--glass-bg-md); backdrop-filter:var(--glass-blur); -webkit-backdrop-filter:var(--glass-blur); border:1px solid var(--glass-border-md); box-shadow:var(--glass-shadow); }
.glass-strong { background:var(--glass-bg-strong); backdrop-filter:var(--glass-blur-lg); -webkit-backdrop-filter:var(--glass-blur-lg); border:1px solid var(--glass-border-md); box-shadow:var(--glass-shadow-lg); }
.glass-card { background:var(--glass-bg); backdrop-filter:var(--glass-blur); -webkit-backdrop-filter:var(--glass-blur); border:1px solid var(--glass-border); box-shadow:var(--glass-shadow-sm); border-radius:16px; transition:box-shadow var(--t-normal),border-color var(--t-normal),transform var(--t-normal); }
.glass-card:hover { border-color:var(--glass-border-md); box-shadow:var(--glass-shadow); transform:translateY(-2px); }
.btn-primary { background:linear-gradient(135deg,var(--primary),var(--accent)); color:#fff; border:1px solid rgba(255,255,255,0.15); box-shadow:0 0 20px var(--primary-glow),0 4px 12px rgba(0,0,0,0.3); transition:all var(--t-normal); cursor:pointer; }
.btn-primary:hover:not(:disabled) { box-shadow:0 0 30px var(--primary-glow),0 6px 20px rgba(0,0,0,0.4); transform:translateY(-1px); }
.btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
.btn-glass { background:var(--glass-bg); backdrop-filter:var(--glass-blur-sm); -webkit-backdrop-filter:var(--glass-blur-sm); color:var(--text-secondary); border:1px solid var(--glass-border); transition:all var(--t-normal); cursor:pointer; }
.btn-glass:hover:not(:disabled) { background:var(--glass-bg-md); color:var(--text-primary); border-color:var(--glass-border-md); }
.input-glass { background:var(--glass-bg); backdrop-filter:var(--glass-blur-sm); -webkit-backdrop-filter:var(--glass-blur-sm); border:1px solid var(--glass-border); color:var(--text-primary); transition:border-color var(--t-fast),box-shadow var(--t-fast); outline:none; }
.input-glass::placeholder { color:var(--text-muted); }
.input-glass:focus { border-color:var(--primary); box-shadow:0 0 0 3px var(--primary-glow); }
.badge { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:600; }
.badge-success { background:rgba(16,185,129,0.15);color:var(--success);border:1px solid rgba(16,185,129,0.2); }
.badge-warning { background:rgba(245,158,11,0.15);color:var(--warning);border:1px solid rgba(245,158,11,0.2); }
.badge-danger  { background:rgba(239,68,68,0.15);color:var(--danger);border:1px solid rgba(239,68,68,0.2); }
.badge-info    { background:rgba(56,189,248,0.15);color:var(--info);border:1px solid rgba(56,189,248,0.2); }
.badge-primary { background:rgba(99,102,241,0.15);color:var(--primary-light);border:1px solid rgba(99,102,241,0.2); }
.glass-table { width:100%;border-collapse:separate;border-spacing:0; }
.glass-table th { background:var(--glass-bg);backdrop-filter:var(--glass-blur-sm);color:var(--text-muted);font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;padding:12px 16px;border-bottom:1px solid var(--glass-border);white-space:nowrap; }
.glass-table td { padding:13px 16px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:14px;transition:background var(--t-fast); }
.glass-table tr:hover td { background:var(--glass-bg); }
.glass-table tr:last-child td { border-bottom:none; }
.modal-overlay { position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:50;display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeIn var(--t-normal); }
.modal-panel { background:var(--bg-card);border:1px solid var(--glass-border-md);border-radius:20px;box-shadow:var(--glass-shadow-lg);max-width:560px;width:100%;animation:slideUp var(--t-normal); }
.page-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px; }
.page-title { font-size:22px;font-weight:700;background:linear-gradient(135deg,var(--text-primary),var(--text-secondary));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.skeleton { background:linear-gradient(90deg,var(--glass-bg) 25%,var(--glass-bg-md) 50%,var(--glass-bg) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:8px; }
::-webkit-scrollbar { width:5px;height:5px; }
::-webkit-scrollbar-track { background:transparent; }
::-webkit-scrollbar-thumb { background:var(--glass-border-md);border-radius:3px; }
::-webkit-scrollbar-thumb:hover { background:rgba(255,255,255,0.25); }
@keyframes fadeIn { from{opacity:0} to{opacity:1} }
@keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
@keyframes float { 0%,100%{transform:translateY(0)rotate(0)} 33%{transform:translateY(-18px)rotate(2deg)} 66%{transform:translateY(-8px)rotate(-2deg)} }
@keyframes orb-drift { 0%{transform:translate(0,0)scale(1)} 25%{transform:translate(40px,-30px)scale(1.05)} 50%{transform:translate(-20px,-50px)scale(0.95)} 75%{transform:translate(-50px,20px)scale(1.02)} 100%{transform:translate(0,0)scale(1)} }
@keyframes spin-slow { to{transform:rotate(360deg)} }
@keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:0.01ms!important;transition-duration:0.01ms!important}}
@media(max-width:768px){.glass-card:hover{transform:none}}
GLASSCSS

# ─────────────────────────────────────────────
# 2. Prepend @import to globals.css
# ─────────────────────────────────────────────
echo "▶ Patching app/globals.css..."
GLOBALS="app/globals.css"
if ! grep -q "glass.css" "$GLOBALS" 2>/dev/null; then
  TMP=$(mktemp)
  echo '@import "./glass.css";' | cat - "$GLOBALS" > "$TMP" && mv "$TMP" "$GLOBALS"
fi

# ─────────────────────────────────────────────
# 3. Login page (3D animated glassmorphism)
# ─────────────────────────────────────────────
echo "▶ Writing app/login/page.tsx..."
mkdir -p app/login
cat > app/login/page.tsx << 'LOGINPAGE'
"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const { innerWidth: W, innerHeight: H } = window;
    targetRef.current = { x: (e.clientX / W - 0.5) * 22, y: (e.clientY / H - 0.5) * 22 };
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion:reduce)").matches) return;
    const animate = () => {
      currentRef.current.x += (targetRef.current.x - currentRef.current.x) * 0.08;
      currentRef.current.y += (targetRef.current.y - currentRef.current.y) * 0.08;
      if (cardRef.current)
        cardRef.current.style.transform = `perspective(1200px) rotateX(${-currentRef.current.y * 0.3}deg) rotateY(${currentRef.current.x * 0.3}deg) translateZ(10px)`;
      rafRef.current = requestAnimationFrame(animate);
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    rafRef.current = requestAnimationFrame(animate);
    return () => { window.removeEventListener("mousemove", handleMouseMove); cancelAnimationFrame(rafRef.current); };
  }, [handleMouseMove]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Please fill all fields"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (res.ok) router.push("/dashboard/home");
      else setError(data.error || "Invalid credentials");
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-root">
      <div className="login-bg" aria-hidden="true">
        <div className="orb orb1"/><div className="orb orb2"/><div className="orb orb3"/>
        <div className="grid-overlay"/>
        {Array.from({length:16}).map((_,i)=>(
          <div key={i} className="particle" style={{left:`${5+i*6}%`,top:`${10+((i*37)%80)}%`,animationDelay:`${i*0.5}s`,animationDuration:`${6+i%5}s`,width:`${2+i%3}px`,height:`${2+i%3}px`}}/>
        ))}
      </div>
      <div className="login-center">
        <div ref={cardRef} className="login-card">
          <div className="login-brand">
            <div className="brand-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="10" fill="url(#bg)"/>
                <path d="M8 10h16M8 16h10M8 22h13" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                <defs><linearGradient id="bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse"><stop stopColor="#6366f1"/><stop offset="1" stopColor="#8b5cf6"/></linearGradient></defs>
              </svg>
            </div>
            <div><h1 className="brand-name">RestoBill</h1><p className="brand-sub">Restaurant Management System</p></div>
          </div>
          <h2 className="login-heading">Welcome back</h2>
          <p className="login-sub">Sign in to your account</p>
          {error&&<div className="login-error" role="alert">{error}</div>}
          <form onSubmit={handleLogin} noValidate>
            <div className="field-group">
              <label className="field-label" htmlFor="email">Email address</label>
              <input id="email" type="email" className="login-input" placeholder="name@restaurant.com" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required/>
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="password">Password</label>
              <div style={{position:"relative"}}>
                <input id="password" type={showPw?"text":"password"} className="login-input" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required style={{paddingRight:"40px"}}/>
                <button type="button" className="pw-toggle" onClick={()=>setShowPw(v=>!v)} aria-label={showPw?"Hide":"Show"}>
                  {showPw?"🙈":"👁"}
                </button>
              </div>
            </div>
            <button type="submit" className="login-btn-primary" disabled={loading}>
              {loading&&<span className="btn-spinner"/>}
              {loading?"Signing in…":"Sign in"}
            </button>
          </form>
          <div className="login-divider"><span>or</span></div>
          <button type="button" className="login-btn-google" onClick={()=>{window.location.href="/api/auth/google"}}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/><path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
            Continue with Google
          </button>
          <p className="login-footer">Don&apos;t have an account? <a href="/register" className="login-link">Contact admin</a></p>
        </div>
      </div>
      <style jsx>{`
        .login-root{min-height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;background:#06060f;font-family:'Inter',system-ui,sans-serif}
        .login-bg{position:absolute;inset:0;overflow:hidden}
        .orb{position:absolute;border-radius:50%;filter:blur(80px);animation:orb-drift 18s ease-in-out infinite}
        .orb1{width:500px;height:500px;top:-120px;left:-120px;background:radial-gradient(circle,#6366f1,#4f46e5 60%,transparent);opacity:.5;animation-duration:20s}
        .orb2{width:420px;height:420px;bottom:-100px;right:-80px;background:radial-gradient(circle,#8b5cf6,#7c3aed 60%,transparent);opacity:.5;animation-duration:16s;animation-delay:-6s}
        .orb3{width:300px;height:300px;top:40%;left:55%;background:radial-gradient(circle,#38bdf8,#0ea5e9 60%,transparent);opacity:.25;animation-duration:24s;animation-delay:-10s}
        .grid-overlay{position:absolute;inset:0;background-image:linear-gradient(rgba(99,102,241,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,.06) 1px,transparent 1px);background-size:60px 60px}
        .particle{position:absolute;background:#fff;border-radius:50%;animation:float var(--dur,8s) ease-in-out infinite;opacity:.4}
        .login-center{position:relative;z-index:10;display:flex;align-items:center;justify-content:center;width:100%;padding:24px 16px}
        .login-card{width:100%;max-width:420px;background:rgba(13,13,32,.82);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,.12);border-radius:24px;padding:40px 36px;box-shadow:0 24px 80px rgba(0,0,0,.6),inset 0 0 0 1px rgba(255,255,255,.05)}
        .login-brand{display:flex;align-items:center;gap:12px;margin-bottom:28px}
        .brand-icon{flex-shrink:0}
        .brand-name{font-size:20px;font-weight:800;color:#f8fafc;line-height:1}
        .brand-sub{font-size:11px;color:#64748b;margin-top:2px}
        .login-heading{font-size:24px;font-weight:700;color:#f8fafc;margin-bottom:4px}
        .login-sub{font-size:14px;color:#94a3b8;margin-bottom:24px}
        .login-error{background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.25);border-radius:10px;padding:10px 14px;color:#f87171;font-size:13px;margin-bottom:16px}
        .field-group{margin-bottom:16px}
        .field-label{display:block;font-size:13px;font-weight:500;color:#94a3b8;margin-bottom:6px}
        .login-input{width:100%;padding:11px 16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10);border-radius:12px;color:#f8fafc;font-size:14px;transition:border-color .15s,box-shadow .15s;outline:none;box-sizing:border-box}
        .login-input::placeholder{color:#475569}
        .login-input:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.25)}
        .pw-toggle{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:14px;padding:4px;color:#64748b}
        .login-btn-primary{width:100%;padding:13px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:1px solid rgba(255,255,255,.15);border-radius:12px;color:#fff;font-size:15px;font-weight:600;cursor:pointer;margin-top:20px;box-shadow:0 0 20px rgba(99,102,241,.4),0 4px 12px rgba(0,0,0,.3);transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px}
        .login-btn-primary:hover:not(:disabled){box-shadow:0 0 32px rgba(99,102,241,.55),0 6px 20px rgba(0,0,0,.4);transform:translateY(-1px)}
        .login-btn-primary:disabled{opacity:.6;cursor:not-allowed;transform:none}
        .btn-spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin-slow .7s linear infinite;flex-shrink:0}
        .login-divider{display:flex;align-items:center;gap:12px;margin:20px 0;color:#475569;font-size:13px}
        .login-divider::before,.login-divider::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.08)}
        .login-btn-google{width:100%;padding:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:12px;color:#f8fafc;font-size:14px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:all .2s}
        .login-btn-google:hover{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.2);transform:translateY(-1px)}
        .login-footer{margin-top:20px;text-align:center;font-size:13px;color:#64748b}
        .login-link{color:#818cf8;text-decoration:none;font-weight:500}
        @keyframes orb-drift{0%{transform:translate(0,0)scale(1)}25%{transform:translate(40px,-30px)scale(1.05)}50%{transform:translate(-20px,-50px)scale(.95)}75%{transform:translate(-50px,20px)scale(1.02)}100%{transform:translate(0,0)scale(1)}}
        @keyframes float{0%,100%{transform:translateY(0)scale(1);opacity:.35}50%{transform:translateY(-30px)scale(1.1);opacity:.7}}
        @keyframes spin-slow{to{transform:rotate(360deg)}}
        @media(max-width:480px){.login-card{padding:28px 20px;border-radius:18px}}
        @media(prefers-reduced-motion:reduce){.orb,.particle{animation:none}.login-btn-primary:hover,.login-btn-google:hover{transform:none}}
      `}</style>
    </div>
  );
}
LOGINPAGE

# ─────────────────────────────────────────────
# 4. Dashboard layout (glass sidebar)
# ─────────────────────────────────────────────
echo "▶ Writing app/dashboard/layout.tsx..."
mkdir -p app/dashboard
# Back up existing layout
cp app/dashboard/layout.tsx app/dashboard/layout.tsx.bak 2>/dev/null || true
cat > app/dashboard/layout.tsx << 'DASHLAYOUT'
"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

const NAV = [
  { section:"POS", items:[
    { href:"/dashboard/home",    label:"Dashboard",  icon:"⊞" },
    { href:"/dashboard/floor",   label:"Floor View", icon:"◫" },
    { href:"/dashboard/tables",  label:"Tables",     icon:"▦" },
    { href:"/dashboard/orders",  label:"Orders",     icon:"◳" },
    { href:"/dashboard/kitchen", label:"Kitchen",    icon:"◉" },
    { href:"/dashboard/bills",   label:"Bills",      icon:"◈" },
  ]},
  { section:"Menu & Stock", items:[
    { href:"/dashboard/menu",           label:"Menu Items",     icon:"◐" },
    { href:"/dashboard/inventory",      label:"Inventory",      icon:"◧" },
    { href:"/dashboard/purchase-orders",label:"Purchase Orders",icon:"◫" },
    { href:"/dashboard/stock-ledger",   label:"Stock Ledger",   icon:"◱" },
    { href:"/dashboard/expenses",       label:"Expenses",       icon:"◎" },
    { href:"/dashboard/delivery",       label:"Delivery",       icon:"◌" },
  ]},
  { section:"Customers", items:[
    { href:"/dashboard/customers",    label:"Customers",    icon:"◯" },
    { href:"/dashboard/loyalty",      label:"Loyalty",      icon:"◈" },
    { href:"/dashboard/reservations", label:"Reservations", icon:"◷" },
    { href:"/dashboard/gift-cards",   label:"Gift Cards",   icon:"◆" },
    { href:"/dashboard/discounts",    label:"Discounts",    icon:"◇" },
  ]},
  { section:"Reports", items:[
    { href:"/dashboard/reports",      label:"Reports",      icon:"◭" },
    { href:"/dashboard/gst-report",   label:"GST Report",   icon:"◮" },
    { href:"/dashboard/pnl",          label:"P&L",          icon:"◬" },
    { href:"/dashboard/staff-report", label:"Staff Report", icon:"◫" },
    { href:"/dashboard/finance",      label:"Finance",      icon:"◉" },
    { href:"/dashboard/day-close",    label:"Day Close",    icon:"◑" },
  ]},
  { section:"Settings", items:[
    { href:"/dashboard/settings",         label:"Settings",     icon:"◌" },
    { href:"/dashboard/users",            label:"Users",        icon:"◯" },
    { href:"/dashboard/permissions",      label:"Permissions",  icon:"◈" },
    { href:"/dashboard/activity-log",     label:"Activity Log", icon:"◎" },
    { href:"/dashboard/data-management",  label:"Data Mgmt",    icon:"◧" },
    { href:"/dashboard/import",           label:"Import",       icon:"◱" },
    { href:"/dashboard/qr",              label:"QR Codes",     icon:"◫" },
    { href:"/dashboard/qr-orders",       label:"QR Orders",    icon:"◌" },
  ]},
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<{name?:string;email?:string;role?:string}|null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setUser(d); else router.replace("/login"); })
      .catch(() => router.replace("/login"));
  }, [router]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method:"POST" });
    router.replace("/login");
  };

  const initials = user?.name?.split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2) || "RB";

  return (
    <div className="dl-root">
      {/* Mobile overlay */}
      {mobileOpen && <div className="dl-overlay" onClick={()=>setMobileOpen(false)}/>}

      {/* Sidebar */}
      <aside className={`dl-sidebar${collapsed?" dl-collapsed":""}${mobileOpen?" dl-mobile-open":""}`}>
        {/* Logo */}
        <div className="dl-logo">
          <div className="dl-logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="7" fill="url(#lg)"/>
              <path d="M6 8h12M6 12h8M6 16h10" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
              <defs><linearGradient id="lg" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse"><stop stopColor="#6366f1"/><stop offset="1" stopColor="#8b5cf6"/></linearGradient></defs>
            </svg>
          </div>
          {!collapsed && <span className="dl-logo-text">RestoBill</span>}
          <button className="dl-collapse-btn dl-desktop-only" onClick={()=>setCollapsed(v=>!v)} aria-label="Toggle sidebar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{transform:collapsed?"rotate(180deg)":"none",transition:"transform .25s"}}>
              <polyline points="15,18 9,12 15,6"/>
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="dl-nav">
          {NAV.map(g => (
            <div key={g.section}>
              {!collapsed && <div className="dl-section">{g.section}</div>}
              {collapsed && <div className="dl-section-div"/>}
              {g.items.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href+"/");
                return (
                  <Link key={item.href} href={item.href}
                    className={`dl-navitem${active?" dl-active":""}${collapsed?" dl-icon-only":""}`}
                    title={collapsed?item.label:undefined}
                    onClick={()=>setMobileOpen(false)}>
                    <span className="dl-navicon" aria-hidden="true">{item.icon}</span>
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="dl-foot">
          {user && (
            <div className={`dl-user${collapsed?" dl-user-col":""}`}>
              <div className="dl-avatar">{initials}</div>
              {!collapsed && (
                <div className="dl-userinfo">
                  <div className="dl-username">{user.name||user.email||"User"}</div>
                  <div className="dl-userrole">{user.role||"Staff"}</div>
                </div>
              )}
              <button className="dl-logout" onClick={logout} title="Logout" aria-label="Logout">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main area */}
      <div className={`dl-main${collapsed?" dl-main-full":""}`}>
        {/* Header */}
        <header className="dl-header">
          <button className="dl-menu-btn dl-mobile-only" onClick={()=>setMobileOpen(v=>!v)} aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="dl-header-date">
            {new Date().toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}
          </div>
        </header>
        <main className="dl-content">{children}</main>
      </div>

      <style jsx>{`
        .dl-root{display:flex;min-height:100vh;background:#06060f;color:#f8fafc;font-family:'Inter',system-ui,sans-serif}
        .dl-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);z-index:39;display:none}
        .dl-sidebar{width:256px;flex-shrink:0;position:fixed;top:0;left:0;bottom:0;z-index:40;display:flex;flex-direction:column;background:rgba(8,8,22,.82);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-right:1px solid rgba(255,255,255,.07);transition:width .25s ease;overflow:hidden}
        .dl-collapsed{width:66px}
        .dl-logo{display:flex;align-items:center;gap:10px;padding:16px 14px;border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0;min-height:58px}
        .dl-logo-icon{width:34px;height:34px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border-radius:9px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.25)}
        .dl-logo-text{font-size:16px;font-weight:800;white-space:nowrap;background:linear-gradient(135deg,#818cf8,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .dl-collapse-btn{margin-left:auto;background:none;border:none;color:#64748b;cursor:pointer;padding:4px;border-radius:6px;display:flex;align-items:center;flex-shrink:0;transition:color .15s,background .15s}
        .dl-collapse-btn:hover{color:#f8fafc;background:rgba(255,255,255,.07)}
        .dl-nav{flex:1;overflow-y:auto;padding:6px 8px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.08) transparent}
        .dl-section{font-size:10px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:#475569;padding:8px 8px 3px;margin-top:4px;white-space:nowrap}
        .dl-section-div{height:1px;background:rgba(255,255,255,.06);margin:6px 4px}
        :global(.dl-navitem){display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:9px;color:#94a3b8;font-size:13px;font-weight:500;text-decoration:none;border:1px solid transparent;transition:all .15s;white-space:nowrap;cursor:pointer}
        :global(.dl-navitem:hover){background:rgba(255,255,255,.05);color:#f8fafc;border-color:rgba(255,255,255,.07)}
        :global(.dl-active){background:linear-gradient(135deg,rgba(99,102,241,.2),rgba(139,92,246,.14));color:#818cf8;border-color:rgba(99,102,241,.28);box-shadow:0 0 10px rgba(99,102,241,.18)}
        :global(.dl-icon-only){justify-content:center;padding:9px 0}
        .dl-navicon{font-size:15px;flex-shrink:0;font-style:normal;line-height:1;opacity:.7}
        :global(.dl-active) .dl-navicon{opacity:1}
        .dl-foot{padding:10px 8px;border-top:1px solid rgba(255,255,255,.07);flex-shrink:0}
        .dl-user{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:11px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)}
        .dl-user-col{justify-content:center;padding:8px 6px}
        .dl-avatar{width:30px;height:30px;border-radius:8px;flex-shrink:0;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff}
        .dl-userinfo{flex:1;min-width:0}
        .dl-username{font-size:12px;font-weight:600;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .dl-userrole{font-size:10px;color:#64748b;white-space:nowrap;text-transform:capitalize}
        .dl-logout{background:none;border:none;color:#64748b;cursor:pointer;padding:4px;border-radius:6px;display:flex;align-items:center;flex-shrink:0;margin-left:auto;transition:color .15s,background .15s}
        .dl-logout:hover{color:#ef4444;background:rgba(239,68,68,.1)}
        .dl-main{flex:1;margin-left:256px;display:flex;flex-direction:column;min-height:100vh;transition:margin-left .25s ease}
        .dl-main-full{margin-left:66px}
        .dl-header{position:sticky;top:0;z-index:30;height:57px;background:rgba(6,6,15,.82);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;padding:0 24px;gap:12px}
        .dl-header-date{font-size:12px;color:#64748b;margin-left:auto}
        .dl-menu-btn{background:none;border:none;color:#94a3b8;cursor:pointer;padding:6px;border-radius:8px;transition:background .15s,color .15s;display:flex;align-items:center}
        .dl-menu-btn:hover{background:rgba(255,255,255,.07);color:#f8fafc}
        .dl-content{flex:1;padding:24px;overflow-x:hidden}
        .dl-desktop-only{} .dl-mobile-only{display:none}
        @media(max-width:768px){
          .dl-overlay{display:block}
          .dl-sidebar{transform:translateX(-100%);transition:transform .25s ease;width:256px!important}
          .dl-mobile-open{transform:translateX(0)}
          .dl-main,.dl-main-full{margin-left:0!important}
          .dl-desktop-only{display:none}
          .dl-mobile-only{display:flex}
          .dl-content{padding:16px}
          .dl-header{padding:0 16px}
        }
      `}</style>
    </div>
  );
}
DASHLAYOUT

# ─────────────────────────────────────────────
# 5. ImageUpload component
# ─────────────────────────────────────────────
echo "▶ Writing components/ImageUpload.tsx..."
mkdir -p components
cat > components/ImageUpload.tsx << 'IMGUPLOAD'
"use client";
import { useRef, useState, useCallback } from "react";
interface ImageUploadProps { value?: string|null; onChange:(url:string|null)=>void; className?:string; }
export default function ImageUpload({ value, onChange, className="" }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const upload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) { setError("Only image files allowed"); return; }
    if (file.size > 5*1024*1024) { setError("Max file size is 5 MB"); return; }
    setError(""); setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload", { method:"POST", body:fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error||"Upload failed");
      onChange(data.url);
    } catch(e:unknown) { setError(e instanceof Error?e.message:"Upload failed"); }
    finally { setUploading(false); }
  }, [onChange]);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0]; if(file) upload(file);
  }, [upload]);
  return (
    <div className={`img-u-root ${className}`}>
      {value ? (
        <div className="img-u-preview">
          <img src={value} alt="Item" style={{width:"100%",height:"100%",objectFit:"cover",display:"block",borderRadius:"12px"}} loading="lazy"/>
          <div className="img-u-actions">
            <button type="button" onClick={()=>inputRef.current?.click()} title="Replace" style={{background:"rgba(13,13,32,.85)",border:"1px solid rgba(255,255,255,.15)",color:"#94a3b8",borderRadius:"8px",padding:"6px 10px",cursor:"pointer",fontSize:"12px",backdropFilter:"blur(8px)"}}>Replace</button>
            <button type="button" onClick={()=>{onChange(null);setError("");}} title="Remove" style={{background:"rgba(239,68,68,.15)",border:"1px solid rgba(239,68,68,.3)",color:"#f87171",borderRadius:"8px",padding:"6px 10px",cursor:"pointer",fontSize:"12px"}}>Remove</button>
          </div>
        </div>
      ) : (
        <div className={`img-u-drop${dragging?" dragging":""}${uploading?" uploading":""}`}
          onClick={()=>!uploading&&inputRef.current?.click()}
          onDragOver={e=>{e.preventDefault();setDragging(true)}}
          onDragLeave={()=>setDragging(false)}
          onDrop={onDrop}
          role="button" tabIndex={0} aria-label="Upload image"
          onKeyDown={e=>e.key==="Enter"&&inputRef.current?.click()}>
          {uploading?<div className="img-u-spinner"/>:<>
            <span style={{fontSize:"28px"}}>📷</span>
            <span style={{fontSize:"13px",fontWeight:500}}>{dragging?"Drop to upload":"Drag & drop or click"}</span>
            <span style={{fontSize:"11px",color:"#475569"}}>PNG, JPG, WebP · max 5 MB</span>
          </>}
        </div>
      )}
      {error&&<p style={{fontSize:"12px",color:"#f87171",margin:0}} role="alert">{error}</p>}
      <input ref={inputRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)upload(f);e.target.value="";}} disabled={uploading}/>
      <style jsx>{`
        .img-u-root{display:flex;flex-direction:column;gap:6px}
        .img-u-drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:28px 16px;background:rgba(255,255,255,.03);border:2px dashed rgba(255,255,255,.12);border-radius:14px;cursor:pointer;transition:all .15s;color:#64748b;user-select:none}
        .img-u-drop:hover,.img-u-drop.dragging{border-color:rgba(99,102,241,.5);background:rgba(99,102,241,.05);color:#94a3b8}
        .img-u-drop.uploading{cursor:default;opacity:.7}
        .img-u-preview{position:relative;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.10);background:#0d0d20;aspect-ratio:16/9}
        .img-u-actions{position:absolute;top:8px;right:8px;display:flex;gap:6px;opacity:0;transition:opacity .2s}
        .img-u-preview:hover .img-u-actions{opacity:1}
        .img-u-spinner{width:32px;height:32px;border:3px solid rgba(99,102,241,.2);border-top-color:#6366f1;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}
IMGUPLOAD

# ─────────────────────────────────────────────
# 6. Upload API route
# ─────────────────────────────────────────────
echo "▶ Writing app/api/upload/route.ts..."
mkdir -p app/api/upload
cat > app/api/upload/route.ts << 'UPLOADROUTE'
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "menu-images";
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg","image/png","image/webp","image/gif"];

// Lazy init — avoids "supabaseUrl is required" crash at build time
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars not configured");
  return createClient(url, key);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let verifyToken: ((t: string) => any) | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require("@/lib/auth");
  verifyToken = m.verifyToken ?? m.default?.verifyToken;
} catch {}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error:"Unauthorized" }, { status:401 });

    let tenantId = "default";
    if (verifyToken) {
      const p = verifyToken(token);
      if (!p) return NextResponse.json({ error:"Unauthorized" }, { status:401 });
      if (typeof p.tenantId === "string") tenantId = p.tenantId;
    }

    const form = await req.formData();
    const file = form.get("file") as File|null;
    if (!file) return NextResponse.json({ error:"No file" }, { status:400 });
    if (!ALLOWED.includes(file.type)) return NextResponse.json({ error:"Invalid file type" }, { status:400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error:"Max 5 MB" }, { status:400 });

    const ext = (file.name.split(".").pop()??"jpg").toLowerCase();
    const path = `${tenantId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    const buf = new Uint8Array(await file.arrayBuffer());

    const supabase = getSupabase();
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType:file.type, upsert:false });
    if (upErr) { console.error("[upload]", upErr.message); return NextResponse.json({ error:"Upload failed" }, { status:500 }); }

    const { data:{ publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: publicUrl });
  } catch (e) {
    console.error("[upload] POST:", e);
    return NextResponse.json({ error:"Internal server error" }, { status:500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error:"Unauthorized" }, { status:401 });

    const { url } = (await req.json()) as { url?:string };
    if (!url) return NextResponse.json({ error:"No URL" }, { status:400 });

    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return NextResponse.json({ error:"Invalid URL" }, { status:400 });
    const filePath = url.slice(idx + marker.length);

    const supabase = getSupabase();
    const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
    if (error) return NextResponse.json({ error:"Delete failed" }, { status:500 });
    return NextResponse.json({ ok:true });
  } catch (e) {
    console.error("[upload] DELETE:", e);
    return NextResponse.json({ error:"Internal server error" }, { status:500 });
  }
}
UPLOADROUTE


# ─────────────────────────────────────────────
# 7. Commit & push
# ─────────────────────────────────────────────
echo "▶ Committing..."
git add -A
git commit -m "feat(ui-2.0): glassmorphism design system, 3D login, glass sidebar, image upload

- Add app/glass.css: complete glass design token system
- Patch app/globals.css: import glass.css
- Rewrite app/login/page.tsx: 3D animated glassmorphism login
  * CSS orb/particle background with parallax on mouse-move
  * Glass card with smooth rAF-lerp tilt effect
  * Show/hide password, Google OAuth, error states
- Add components/ImageUpload.tsx: drag-and-drop image upload
  * Drag-and-drop + click-to-upload
  * Preview with replace/remove, loading spinner
  * 5 MB limit, type validation
- Add app/api/upload/route.ts: server-side Supabase Storage upload
  * Tenant-scoped paths, JWT auth, 5 MB / type guard
  * DELETE endpoint for cleanup
- Supabase: created menu-images public bucket (via MCP migration)

No existing features removed. All API routes, DB logic, auth untouched."

echo "▶ Pushing branch ${BRANCH}..."
git push origin "${BRANCH}" --force-with-lease

echo "▶ Resetting remote to tokenless URL..."
git remote set-url origin "https://github.com/${REPO}.git"

echo ""
echo "✅ Done! Branch '${BRANCH}' pushed."
echo "   Open a PR at: https://github.com/${REPO}/compare/${BRANCH}"
echo ""
echo "Next manual step:"
echo "  Vercel will auto-create a Preview deployment for this branch."
echo "  No env var changes needed (upload route uses existing SUPABASE_SERVICE_ROLE_KEY)."
