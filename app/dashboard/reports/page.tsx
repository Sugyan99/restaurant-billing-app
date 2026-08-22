"use client";
import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import Skeleton from "@mui/material/Skeleton";
import LinearProgress from "@mui/material/LinearProgress";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";

type Report = {
  totalRevenue: number; totalOrders: number; avgOrderValue: number; totalTax: number;
  paymentBreakdown: Record<string, number>;
  topItems: { name: string; quantity: number; revenue: number }[];
  categorySales: { name: string; revenue: number }[];
};

const PERIODS = [
  { key: "today",     label: "Today"      },
  { key: "yesterday", label: "Yesterday"  },
  { key: "week",      label: "Last 7 Days"},
  { key: "month",     label: "This Month" },
  { key: "custom",    label: "Custom"     },
] as const;
type Period = typeof PERIODS[number]["key"];

const KPI = [
  { label:"Revenue",       icon:"💰", color:"#16A34A", bg:"#F0FDF4", key:"totalRevenue",   fmt:(v:number)=>`₹${v.toLocaleString("en-IN")}` },
  { label:"Orders",        icon:"🧾", color:"#2563EB", bg:"#EFF6FF", key:"totalOrders",    fmt:(v:number)=>String(v) },
  { label:"Avg Order",     icon:"📊", color:"#7C3AED", bg:"#F5F3FF", key:"avgOrderValue",  fmt:(v:number)=>`₹${v.toLocaleString("en-IN")}` },
  { label:"Tax Collected", icon:"🏛️", color:"#D97706", bg:"#FFFBEB", key:"totalTax",       fmt:(v:number)=>`₹${v.toLocaleString("en-IN")}` },
] as const;

export default function ReportsPage() {
  const [report, setReport]     = useState<Report | null>(null);
  const [period, setPeriod]     = useState<Period>("today");
  const [loading, setLoading]   = useState(true);
  const [exporting, setExporting] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate]     = useState(new Date().toISOString().slice(0,10));

  function buildUrl(exp = false) {
    if (period === "custom" && fromDate)
      return `/api/reports?from=${fromDate}&to=${toDate}${exp ? "&export=csv" : ""}`;
    return `/api/reports?type=${period}${exp ? "&export=csv" : ""}`;
  }

  useEffect(() => {
    if (period === "custom" && !fromDate) return;
    setLoading(true);
    fetch(buildUrl()).then(r => r.json()).then(d => { setReport(d); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, fromDate, toDate]);

  async function exportCsv() {
    if (period === "custom" && !fromDate) return;
    setExporting(true);
    const res  = await fetch(buildUrl(true));
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `sales-report-${period}.csv`; a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  const maxRevenue    = Math.max(...(report?.topItems?.map(i => i.revenue) ?? [1]));
  const maxCatRev     = Math.max(...(report?.categorySales?.map(c => c.revenue) ?? [1]));
  const totalPayments = Object.values(report?.paymentBreakdown ?? {}).reduce((s,v) => s+v, 0);

  return (
    <Box>
      {/* Controls */}
      <Card elevation={0} sx={{ mb:3 }}>
        <CardContent sx={{ p:{ xs:1.5, md:2 }, "&:last-child":{ pb:"16px!important" } }}>
          <Stack direction="row" sx={{ flexWrap:"wrap", gap:1, alignItems:"center" }}>
            <ButtonGroup size="small" variant="outlined" sx={{ flexWrap:"wrap", gap:.5 }}>
              {PERIODS.map(p => (
                <Button key={p.key} onClick={() => setPeriod(p.key)}
                  variant={period === p.key ? "contained" : "outlined"}
                  sx={{ fontSize:{ xs:11, md:13 } }}>
                  {p.label}
                </Button>
              ))}
            </ButtonGroup>
            {period === "custom" && (
              <Stack direction="row" sx={{ alignItems:"center", gap:1, flexWrap:"wrap" }}>
                <TextField type="date" size="small" value={fromDate} onChange={e => setFromDate(e.target.value)}
                  sx={{ width:{ xs:140, md:160 } }} slotProps={{ input:{ style:{fontSize:13} } }} />
                <Typography color="text.secondary">→</Typography>
                <TextField type="date" size="small" value={toDate} onChange={e => setToDate(e.target.value)}
                  sx={{ width:{ xs:140, md:160 } }} slotProps={{ input:{ style:{fontSize:13} } }} />
              </Stack>
            )}
            <Button size="small" variant="outlined" onClick={exportCsv} disabled={exporting}
              sx={{ ml:"auto", fontSize:{ xs:11, md:13 } }}>
              {exporting ? "Exporting…" : "📥 Export CSV"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* KPI Grid */}
      <Grid container spacing={2} sx={{ mb:3 }}>
        {loading
          ? [1,2,3,4].map(i => <Grid key={i} size={{ xs:6, md:3 }}><Skeleton variant="rounded" height={100} sx={{ borderRadius:2 }}/></Grid>)
          : KPI.map(k => {
              const val = report ? (report as never)[k.key] as number : 0;
              return (
                <Grid key={k.key} size={{ xs:6, md:3 }}>
                  <Card elevation={0} sx={{ borderLeft:`3px solid ${k.color}` }}>
                    <CardContent sx={{ p:"16px!important" }}>
                      <Box sx={{ width:40, height:40, borderRadius:1.5, bgcolor:k.bg, display:"flex", alignItems:"center", justifyContent:"center", mb:1, fontSize:20 }}>
                        {k.icon}
                      </Box>
                      <Typography sx={{ fontSize:{ xs:18, md:22 }, fontWeight:900, color:k.color }}>{k.fmt(val)}</Typography>
                      <Typography sx={{ fontSize:12, color:"text.secondary" }}>{k.label}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })
        }
      </Grid>

      {!loading && report && (
        <>
          <Grid container spacing={2.5} sx={{ mb:2.5 }}>
            {/* Payment Breakdown */}
            <Grid size={{ xs:12, md:6 }}>
              <Card elevation={0} sx={{ height:"100%" }}>
                <CardContent sx={{ p:{ xs:2, md:2.5 } }}>
                  <Typography variant="h6" sx={{ fontSize:15, mb:2 }}>Payment Breakdown</Typography>
                  {Object.entries(report.paymentBreakdown).map(([mode, amount]) => (
                    <Box key={mode} sx={{ mb:1.5 }}>
                      <Box sx={{ display:"flex", justifyContent:"space-between", mb:.5 }}>
                        <Typography sx={{ fontSize:13 }}>{mode}</Typography>
                        <Typography sx={{ fontSize:13, fontWeight:700 }}>
                          ₹{amount.toLocaleString("en-IN")} ({totalPayments > 0 ? ((amount/totalPayments)*100).toFixed(1) : 0}%)
                        </Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={totalPayments > 0 ? (amount/totalPayments)*100 : 0}
                        sx={{ height:8, borderRadius:2, bgcolor:"#F1F5F9", "& .MuiLinearProgress-bar":{ bgcolor:"primary.main" } }}/>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>

            {/* Category Sales */}
            <Grid size={{ xs:12, md:6 }}>
              <Card elevation={0} sx={{ height:"100%" }}>
                <CardContent sx={{ p:{ xs:2, md:2.5 } }}>
                  <Typography variant="h6" sx={{ fontSize:15, mb:2 }}>Category Revenue</Typography>
                  {report.categorySales.sort((a,b) => b.revenue - a.revenue).map(c => (
                    <Box key={c.name} sx={{ mb:1.5 }}>
                      <Box sx={{ display:"flex", justifyContent:"space-between", mb:.5 }}>
                        <Typography sx={{ fontSize:13 }}>{c.name}</Typography>
                        <Typography sx={{ fontSize:13, fontWeight:700 }}>₹{c.revenue.toLocaleString("en-IN")}</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={(c.revenue/maxCatRev)*100}
                        sx={{ height:8, borderRadius:2, bgcolor:"#F1F5F9", "& .MuiLinearProgress-bar":{ bgcolor:"#7C3AED" } }}/>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Top Items */}
          <Card elevation={0}>
            <CardContent sx={{ p:{ xs:2, md:2.5 } }}>
              <Typography variant="h6" sx={{ fontSize:15, mb:2 }}>Top Selling Items</Typography>
              <Stack spacing={1.5}>
                {report.topItems.map((item, i) => (
                  <Box key={item.name}>
                    <Box sx={{ display:"flex", alignItems:"center", gap:1.5, mb:.75 }}>
                      <Box sx={{ width:26, height:26, borderRadius:"50%", bgcolor: i < 3 ? "#FEF3C7" : "#F1F5F9",
                        display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, flexShrink:0 }}>
                        {i < 3 ? ["🥇","🥈","🥉"][i] : i+1}
                      </Box>
                      <Box sx={{ flex:1 }}>
                        <Box sx={{ display:"flex", justifyContent:"space-between", mb:.5 }}>
                          <Typography sx={{ fontSize:13, fontWeight:600 }}>{item.name}</Typography>
                          <Typography sx={{ fontSize:12, color:"text.secondary" }}>{item.quantity} sold · ₹{item.revenue.toLocaleString("en-IN")}</Typography>
                        </Box>
                        <LinearProgress variant="determinate" value={(item.revenue/maxRevenue)*100}
                          sx={{ height:6, borderRadius:2, bgcolor:"#F1F5F9",
                            "& .MuiLinearProgress-bar":{ background:"linear-gradient(90deg,#16A34A,#4ADE80)" } }}/>
                      </Box>
                    </Box>
                    {i < report.topItems.length - 1 && <Divider sx={{ opacity:.4 }}/>}
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}
