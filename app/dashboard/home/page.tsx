"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

/* ── MUI ── */
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";

type Stats = {
  totalRevenue: number; totalOrders: number; avgOrderValue: number; totalTax: number;
  paymentBreakdown: Record<string, number>;
  topItems: { name: string; quantity: number; revenue: number }[];
};
type Order = {
  id: string; orderNumber: number; status: string; type: string;
  createdAt: string; table?: { number: string };
  items: { quantity: number; price: number }[];
};
type Table = { id: string; number: string; status: string };
type Forecast = {
  historical: { date: string; revenue: number; orders: number }[];
  forecast: { date: string; predicted: number; low: number; high: number }[];
  summary: { avgDailyRevenue: number; thisWeekRevenue: number; lastWeekRevenue: number; weekOnWeekGrowth: number; forecastNextWeek: number };
};

const KPI_COLORS = ["#16A34A","#2563EB","#7C3AED","#D97706"];
const KPI_BGAS   = ["#F0FDF4","#EFF6FF","#F5F3FF","#FFFBEB"];

export default function HomePage() {
  const router = useRouter();
  const [stats, setStats]       = useState<Stats | null>(null);
  const [yday, setYday]         = useState<{ totalRevenue: number; totalOrders: number } | null>(null);
  const [orders, setOrders]     = useState<Order[]>([]);
  const [tables, setTables]     = useState<Table[]>([]);
  const [time, setTime]         = useState(new Date());
  const [loading, setLoading]   = useState(true);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [showForecast, setShowForecast] = useState(false);

  const load = useCallback(async () => {
    const [sRes, yRes, oRes, tRes, fRes] = await Promise.all([
      fetch("/api/reports?type=today"),
      fetch("/api/reports?type=yesterday"),
      fetch("/api/orders?status=PENDING"),
      fetch("/api/tables"),
      fetch("/api/forecasting"),
    ]);
    const [s, y, o, t, f] = await Promise.all([sRes.json(), yRes.json(), oRes.json(), tRes.json(), fRes.json()]);
    setStats(s); setYday(y); setOrders(o.orders ?? []); setTables(t.tables ?? []);
    setForecast(f); setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const di = setInterval(load, 30000);
    const ci = setInterval(() => setTime(new Date()), 1000);
    return () => { clearInterval(di); clearInterval(ci); };
  }, [load]);

  const freeTables     = tables.filter(t => t.status === "FREE").length;
  const occupiedTables = tables.filter(t => t.status === "OCCUPIED").length;

  function pct(today: number, yesterday: number) {
    if (!yesterday) return null;
    const d = ((today - yesterday) / yesterday) * 100;
    return { value: Math.abs(d).toFixed(1), up: d >= 0 };
  }
  const revPct = stats && yday ? pct(stats.totalRevenue, yday.totalRevenue) : null;
  const ordPct = stats && yday ? pct(stats.totalOrders,  yday.totalOrders)  : null;

  const hour = time.getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  const KPI_DATA = [
    { label:"Today's Revenue", value:`₹${(stats?.totalRevenue??0).toLocaleString("en-IN")}`, icon:"💰", pct: revPct },
    { label:"Orders Today",    value: stats?.totalOrders??0,                                   icon:"🧾", pct: ordPct },
    { label:"Avg Order Value", value:`₹${(stats?.avgOrderValue??0).toLocaleString("en-IN")}`,  icon:"📊", pct: null },
    { label:"Tax Collected",   value:`₹${(stats?.totalTax??0).toLocaleString("en-IN")}`,       icon:"🏛️", pct: null },
  ];

  return (
    <Box>
      <style>{CSS3D}</style>

      {/* ── Hero Banner ── */}
      <Paper className="hd-hero" elevation={0} sx={{ mb:3, borderRadius:3, overflow:"hidden" }}>
        <Box className="hd-hero-bg">
          <span className="hd-orb hd-o1"/><span className="hd-orb hd-o2"/>
          <span className="hd-geo hd-g1">⬡</span><span className="hd-geo hd-g2">◈</span>
          <span className="hd-geo hd-g3">⬟</span><span className="hd-geo hd-g4">◆</span>
        </Box>

        <Box className="hd-hero-content" sx={{ position:"relative", zIndex:1,
          display:"flex", justifyContent:"space-between", alignItems:"center",
          px:{ xs:2, md:3.5 }, pt:{ xs:2.5, md:3 }, pb:2, gap:2, flexWrap:"wrap",
        }}>
          <Box>
            <Typography sx={{ color:"#fff", fontWeight:800, fontSize:{ xs:18, md:22 } }}>
              {greeting} 👋
            </Typography>
            <Typography sx={{ color:"#94A3B8", fontSize:{ xs:11, md:13 }, mt:0.4 }}>
              {time.toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}
              {" · "}{time.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{flexWrap:"wrap"}}>
            <Box className="hd-live-badge"><span className="hd-live-dot"/>Live</Box>
            <Button
              size="small" variant="outlined"
              onClick={() => setShowForecast(!showForecast)}
              sx={{ color:"#CBD5E1", borderColor:"rgba(255,255,255,0.18)", fontSize:12,
                "&:hover":{ borderColor:"rgba(255,255,255,0.3)", bgcolor:"rgba(255,255,255,0.07)" },
              }}
            >
              {showForecast ? "📊 Hide Forecast" : "🔮 Show Forecast"}
            </Button>
            <Button size="small" variant="contained" onClick={() => router.push("/dashboard/tables")}
              sx={{ fontSize:12 }}>+ New Order</Button>
          </Stack>
        </Box>

        {/* Quick stat chips */}
        <Stack direction="row" spacing={1.5} sx={{ px:{ xs:2, md:3.5 }, pb:2.5, position:"relative", zIndex:1, flexWrap:"wrap" }} useFlexGap>
          {[
            { icon:"🪑", label:"Tables",  val:`${occupiedTables}/${tables.length}`, color:"#E8721C" },
            { icon:"🍳", label:"Pending", val:orders.length,                         color:"#DC2626" },
            { icon:"💰", label:"Revenue", val:`₹${((stats?.totalRevenue??0)/1000).toFixed(1)}k`, color:"#16A34A" },
          ].map(c => (
            <Box key={c.label} className="hd-chip">
              <Typography sx={{ fontSize:20 }}>{c.icon}</Typography>
              <Box>
                <Typography sx={{ fontSize:17, fontWeight:800, color:c.color, lineHeight:1.1 }}>{c.val}</Typography>
                <Typography sx={{ fontSize:10, fontWeight:600, color:"#64748B", textTransform:"uppercase", letterSpacing:.5 }}>{c.label}</Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      </Paper>

      {/* ── KPI Grid ── */}
      <Grid container spacing={2} sx={{ mb:3 }}>
        {loading
          ? [1,2,3,4].map(i => (
              <Grid key={i} size={{ xs:6, md:3 }}>
                <Skeleton variant="rounded" height={110} sx={{ borderRadius:2 }} />
              </Grid>
            ))
          : KPI_DATA.map((s, idx) => (
              <Grid key={s.label} size={{ xs:6, md:3 }}>
                <Card className="kpi-3d" elevation={0}>
                  <CardContent sx={{ p:"16px!important" }}>
                    <Box className="kpi-icon-wrap" sx={{
                      width:44, height:44, borderRadius:1.5, display:"flex", alignItems:"center", justifyContent:"center",
                      bgcolor: KPI_BGAS[idx], border:`1px solid ${KPI_COLORS[idx]}22`,
                      mb:1.25, boxShadow:`0 2px 8px ${KPI_COLORS[idx]}20`,
                    }}>
                      <Typography sx={{ fontSize:20 }}>{s.icon}</Typography>
                    </Box>
                    <Typography sx={{ fontSize:{ xs:18, md:22 }, fontWeight:900, color:KPI_COLORS[idx], lineHeight:1.1, mb:0.4 }}>
                      {s.value}
                    </Typography>
                    <Typography sx={{ fontSize:{ xs:11, md:12 }, color:"text.secondary" }}>{s.label}</Typography>
                    {s.pct && (
                      <Typography sx={{ fontSize:11, color: s.pct.up ? "#16A34A" : "#DC2626", fontWeight:600, mt:0.5 }}>
                        {s.pct.up ? "▲" : "▼"} {s.pct.value}% vs yesterday
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))
        }
      </Grid>

      {/* ── Forecast ── */}
      {showForecast && forecast && (
        <Card elevation={0} sx={{ mb:3 }}>
          <CardContent sx={{ p:{ xs:2, md:2.5 } }}>
            <Box sx={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", mb:2, gap:2, flexWrap:"wrap" }}>
              <Box>
                <Typography variant="h6" sx={{ fontSize:15, mb:0.25 }}>🔮 7-Day Revenue Forecast</Typography>
                <Typography sx={{ fontSize:12, color:"text.secondary" }}>Based on last 30 days · Moving avg + linear regression</Typography>
              </Box>
              <Stack direction="row" spacing={3}>
                <Box sx={{ textAlign:"right" }}>
                  <Typography sx={{ fontWeight:800, color: forecast.summary.weekOnWeekGrowth>=0 ? "#16A34A":"#DC2626" }}>
                    {forecast.summary.weekOnWeekGrowth>=0?"▲":"▼"} {Math.abs(forecast.summary.weekOnWeekGrowth)}%
                  </Typography>
                  <Typography sx={{ fontSize:11, color:"text.secondary" }}>Week-on-week</Typography>
                </Box>
                <Box sx={{ textAlign:"right" }}>
                  <Typography sx={{ fontWeight:800, color:"#2563EB" }}>₹{forecast.summary.forecastNextWeek.toLocaleString("en-IN")}</Typography>
                  <Typography sx={{ fontSize:11, color:"text.secondary" }}>Forecast next 7d</Typography>
                </Box>
              </Stack>
            </Box>
            <Box sx={{ display:"flex", gap:1, alignItems:"flex-end", height:110, overflowX:"auto" }}>
              {forecast.historical.slice(-7).map((d, i) => {
                const maxH = Math.max(...forecast.historical.slice(-7).map(x=>x.revenue),...forecast.forecast.map(x=>x.high),1);
                return (
                  <Box key={`h${i}`} sx={{ flex:1, minWidth:24, display:"flex", flexDirection:"column", alignItems:"center", gap:.5 }}>
                    <Box sx={{ width:"100%", bgcolor:"#E2E8F0", borderRadius:"4px 4px 0 0", height:`${(d.revenue/maxH)*90}px`, minHeight:2, transition:"height .3s" }} title={`₹${d.revenue}`}/>
                    <Typography sx={{ fontSize:8, color:"text.disabled", whiteSpace:"nowrap" }}>{d.date}</Typography>
                  </Box>
                );
              })}
              <Divider orientation="vertical" flexItem sx={{ mx:.5 }}/>
              {forecast.forecast.map((f, i) => {
                const maxH = Math.max(...forecast.historical.slice(-7).map(x=>x.revenue),...forecast.forecast.map(x=>x.high),1);
                return (
                  <Box key={`f${i}`} sx={{ flex:1, minWidth:24, display:"flex", flexDirection:"column", alignItems:"center", gap:.5 }}>
                    <Box sx={{ width:"100%", position:"relative", height:`${(f.high/maxH)*90}px`, minHeight:4 }}>
                      <Box sx={{ position:"absolute", bottom:0, inset:0, bgcolor:"#DBEAFE", borderRadius:"4px 4px 0 0" }} title={`High: ₹${f.high}`}/>
                      <Box sx={{ position:"absolute", bottom:0, left:"10%", right:"10%", bgcolor:"#2563EB", borderRadius:"4px 4px 0 0", height:`${(f.predicted/f.high)*100}%` }} title={`₹${f.predicted}`}/>
                    </Box>
                    <Typography sx={{ fontSize:8, color:"#2563EB", whiteSpace:"nowrap" }}>{f.date}</Typography>
                  </Box>
                );
              })}
            </Box>
            <Stack direction="row" spacing={2} sx={{ mt:1.25 }}>
              {[{c:"#E2E8F0",l:"Historical"},{c:"#2563EB",l:"Predicted"},{c:"#DBEAFE",l:"Range ±20%"}].map(x => (
                <Stack key={x.l} direction="row" spacing={.5} sx={{alignItems:"center"}}>
                  <Box sx={{ width:10, height:10, bgcolor:x.c, borderRadius:.5 }}/>
                  <Typography sx={{ fontSize:11, color:"text.secondary" }}>{x.l}</Typography>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* ── Tables + Payments ── */}
      <Grid container spacing={2} sx={{ mb:2.5 }}>
        {/* Table Status */}
        <Grid size={{ xs:12, md:6 }}>
          <Card elevation={0} sx={{ height:"100%" }}>
            <CardContent sx={{ p:{ xs:2, md:2.5 } }}>
              <Typography variant="h6" sx={{ fontSize:15, mb:2 }}>Table Status</Typography>
              <Grid container spacing={1.5} sx={{ mb:2 }}>
                {[
                  { label:"Free",     count:freeTables,     color:"#16A34A", bg:"#F0FDF4" },
                  { label:"Occupied", count:occupiedTables, color:"#DC2626", bg:"#FEF2F2" },
                  { label:"Total",    count:tables.length,  color:"#2563EB", bg:"#EFF6FF" },
                ].map(t => (
                  <Grid key={t.label} size={4}>
                    <Box sx={{ bgcolor:t.bg, borderRadius:2, py:1.5, textAlign:"center", border:`1px solid ${t.color}22` }}>
                      <Typography sx={{ fontSize:22, fontWeight:900, color:t.color }}>{t.count}</Typography>
                      <Typography sx={{ fontSize:11, color:t.color, fontWeight:600 }}>{t.label}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
              <Button variant="contained" fullWidth size="small" onClick={() => router.push("/dashboard/tables")}>
                Manage Tables →
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Payment Breakdown */}
        <Grid size={{ xs:12, md:6 }}>
          <Card elevation={0} sx={{ height:"100%" }}>
            <CardContent sx={{ p:{ xs:2, md:2.5 } }}>
              <Typography variant="h6" sx={{ fontSize:15, mb:2 }}>Today's Payments</Typography>
              {loading
                ? <Skeleton variant="rounded" height={80}/>
                : Object.keys(stats?.paymentBreakdown??{}).length === 0
                  ? <Typography sx={{ color:"text.secondary", fontSize:13, py:2 }}>No payments yet</Typography>
                  : Object.entries(stats?.paymentBreakdown??{}).map(([mode, amount]) => {
                      const total = Object.values(stats?.paymentBreakdown??{}).reduce((s,v) => s+v, 0);
                      return (
                        <Box key={mode} sx={{ mb:1.5 }}>
                          <Box sx={{ display:"flex", justifyContent:"space-between", mb:.5 }}>
                            <Typography sx={{ fontSize:13 }}>{mode}</Typography>
                            <Typography sx={{ fontSize:13, fontWeight:700 }}>₹{(amount as number).toLocaleString("en-IN")}</Typography>
                          </Box>
                          <LinearProgress variant="determinate" value={total > 0 ? ((amount as number)/total)*100 : 0}
                            sx={{ borderRadius:2, height:6, bgcolor:"#F1F5F9",
                              "& .MuiLinearProgress-bar":{ bgcolor:"primary.main" } }}/>
                        </Box>
                      );
                    })
              }
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Pending Orders ── */}
      <Card elevation={0} sx={{ mb:2.5 }}>
        <CardContent sx={{ p:{ xs:2, md:2.5 } }}>
          <Box sx={{ display:"flex", justifyContent:"space-between", alignItems:"center", mb:2, flexWrap:"wrap", gap:1 }}>
            <Stack direction="row" spacing={1} sx={{alignItems:"center"}}>
              <Typography variant="h6" sx={{ fontSize:15 }}>Pending Orders</Typography>
              {orders.length > 0 && (
                <Chip label={orders.length} size="small" color="error" sx={{ fontSize:11, height:20 }}/>
              )}
            </Stack>
            <Button size="small" variant="outlined" onClick={() => router.push("/dashboard/orders")} sx={{ fontSize:12 }}>
              View All →
            </Button>
          </Box>
          {orders.length === 0
            ? <Typography sx={{ textAlign:"center", py:4, color:"text.secondary" }}>No pending orders 🎉</Typography>
            : <Stack spacing={1}>
                {orders.slice(0,5).map(o => (
                  <Box key={o.id} sx={{
                    display:"flex", justifyContent:"space-between", alignItems:"center",
                    px:2, py:1.25, bgcolor:"#FFF7ED", borderRadius:2,
                    border:"1px solid #FED7AA", flexWrap:"wrap", gap:1,
                  }}>
                    <Stack direction="row" spacing={1} sx={{flexWrap:"wrap",alignItems:"center"}}>
                      <Typography sx={{ fontWeight:700 }}>#{o.orderNumber}</Typography>
                      {o.table && <Chip label={`Table ${o.table.number}`} size="small" sx={{ fontSize:10, height:18 }}/>}
                      <Chip label={o.type} size="small" variant="outlined" sx={{ fontSize:10, height:18 }}/>
                    </Stack>
                    <Typography sx={{ fontSize:12, color:"text.secondary" }}>
                      {Math.floor((Date.now()-new Date(o.createdAt).getTime())/60000)}m ago
                    </Typography>
                  </Box>
                ))}
              </Stack>
          }
        </CardContent>
      </Card>

      {/* ── Top Items ── */}
      {(stats?.topItems?.length ?? 0) > 0 && (
        <Card elevation={0}>
          <CardContent sx={{ p:{ xs:2, md:2.5 } }}>
            <Typography variant="h6" sx={{ fontSize:15, mb:2 }}>Top Items Today</Typography>
            <Box sx={{ display:"flex", gap:1.25, flexWrap:"wrap" }}>
              {stats?.topItems?.slice(0,6).map((item, i) => (
                <Box key={item.name} sx={{
                  bgcolor:"#F8FAFC", borderRadius:2, px:2, py:1, display:"flex", alignItems:"center", gap:1,
                  border:"1px solid #E2E8F0", minWidth:{ xs:"calc(50% - 6px)", sm:"auto" },
                }}>
                  <Typography sx={{ fontSize:18 }}>{["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣"][i]}</Typography>
                  <Box>
                    <Typography sx={{ fontWeight:600, fontSize:13 }}>{item.name}</Typography>
                    <Typography sx={{ fontSize:11, color:"text.secondary" }}>{item.quantity} sold</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

const CSS3D = `
.hd-hero{
  background:linear-gradient(135deg,#0F1623 0%,#1A2232 60%,#0F1623 100%);
  border:1px solid rgba(232,114,28,0.18);
  box-shadow:0 8px 40px rgba(0,0,0,0.14),inset 0 1px 0 rgba(255,255,255,0.06);
}
.hd-hero-bg{position:absolute;inset:0;pointer-events:none;overflow:hidden;border-radius:inherit;}
.hd-orb{position:absolute;border-radius:50%;filter:blur(60px);}
.hd-o1{width:280px;height:280px;top:-100px;left:-60px;background:radial-gradient(circle,rgba(232,114,28,0.14),transparent 70%);animation:hdO1 10s ease-in-out infinite;}
.hd-o2{width:220px;height:220px;bottom:-80px;right:8%;background:radial-gradient(circle,rgba(99,102,241,0.1),transparent 70%);animation:hdO2 14s ease-in-out infinite;}
@keyframes hdO1{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,12px)}}
@keyframes hdO2{0%,100%{transform:translate(0,0)}50%{transform:translate(-16px,-20px)}}
.hd-geo{position:absolute;opacity:.055;font-size:32px;line-height:1;pointer-events:none;animation:hdGeo linear infinite;}
.hd-g1{top:12%;left:8%;color:#E8721C;animation-duration:18s;}
.hd-g2{top:55%;left:16%;color:#6366F1;animation-duration:22s;animation-delay:-6s;font-size:22px;}
.hd-g3{top:20%;right:10%;color:#F59E0B;animation-duration:20s;animation-delay:-10s;font-size:26px;}
.hd-g4{bottom:15%;right:22%;color:#E8721C;animation-duration:16s;animation-delay:-4s;font-size:18px;}
@keyframes hdGeo{0%,100%{transform:rotate(0deg) scale(1)}50%{transform:rotate(180deg) scale(1.12)}}
.hd-live-badge{
  display:flex;align-items:center;gap:6px;
  background:rgba(22,163,74,0.12);border:1px solid rgba(22,163,74,0.25);
  border-radius:20px;padding:4px 12px;font-size:11px;font-weight:700;color:#4ADE80;
  white-space:nowrap;
}
.hd-live-dot{width:6px;height:6px;border-radius:50%;background:#22C55E;flex-shrink:0;
  box-shadow:0 0 6px #22C55E;animation:hdPulse 2s ease-in-out infinite;}
@keyframes hdPulse{0%,100%{box-shadow:0 0 6px #22C55E}50%{box-shadow:0 0 12px #22C55E,0 0 20px rgba(34,197,94,0.3)}}
.hd-chip{
  display:flex;align-items:center;gap:10px;
  background:rgba(255,255,255,0.04);border-radius:12px;padding:10px 16px;
  border:1px solid rgba(255,255,255,0.07);
  box-shadow:0 4px 16px rgba(0,0,0,0.18),inset 0 1px 0 rgba(255,255,255,0.06);
  transition:transform .2s ease,box-shadow .2s ease;cursor:default;
  backdrop-filter:blur(10px);flex:1;min-width:100px;
}
.hd-chip:hover{
  transform:perspective(300px) translateZ(8px) translateY(-2px);
  box-shadow:0 10px 28px rgba(0,0,0,0.22),inset 0 1px 0 rgba(255,255,255,0.09);
  background:rgba(255,255,255,0.06);
}
.kpi-3d{
  transition:transform .25s cubic-bezier(0.2,0.9,0.2,1),box-shadow .25s ease;
  cursor:default;position:relative;overflow:hidden;
}
.kpi-3d::before{
  content:'';position:absolute;top:0;left:0;right:0;height:50%;
  background:linear-gradient(180deg,rgba(255,255,255,0.045) 0%,transparent 100%);
  border-radius:14px 14px 0 0;pointer-events:none;
}
.kpi-3d:hover{
  transform:perspective(500px) translateZ(14px) translateY(-5px);
  box-shadow:0 20px 48px rgba(0,0,0,0.12),0 8px 20px rgba(0,0,0,0.07) !important;
}
`;
