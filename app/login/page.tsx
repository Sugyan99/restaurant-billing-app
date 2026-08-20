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
