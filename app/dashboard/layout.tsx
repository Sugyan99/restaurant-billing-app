"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ToastContainer } from "@/components/Toast";
import { AIAssistant } from "@/components/AIAssistant";
import NotificationBadge from "@/components/NotificationBadge";

/* ── MUI ── */
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Collapse from "@mui/material/Collapse";
import Badge from "@mui/material/Badge";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import InputBase from "@mui/material/InputBase";
import Paper from "@mui/material/Paper";
import Popover from "@mui/material/Popover";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import Divider from "@mui/material/Divider";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

const DRAWER_W = 228;

const NAV = [
  {
    title: "Operations",
    items: [
      { href: "/dashboard/home",           icon: "🏠", label: "Dashboard" },
      { href: "/dashboard/tables",         icon: "🪑", label: "Tables & POS" },
      { href: "/dashboard/orders",         icon: "🍳", label: "Kitchen / KOT", badge: true },
      { href: "/dashboard/kitchen",        icon: "👨‍🍳", label: "Kitchen Display" },
      { href: "/dashboard/bills",          icon: "🧾", label: "Bills & Payments" },
      { href: "/dashboard/qr-orders",       icon: "📱", label: "QR Orders",         badge: true },
      { href: "/dashboard/delivery",       icon: "🛵", label: "Delivery & Takeaway" },
      { href: "/dashboard/reservations",   icon: "📅", label: "Reservations" },
    ],
  },
  {
    title: "Management",
    items: [
      { href: "/dashboard/menu",           icon: "🍽️", label: "Menu & Import" },
      { href: "/dashboard/inventory",      icon: "📦", label: "Inventory & Stock" },
      { href: "/dashboard/purchase-orders",icon: "🛒", label: "Purchase Orders" },
      { href: "/dashboard/customers",      icon: "👤", label: "Customers & Loyalty" },
      { href: "/dashboard/gift-cards",     icon: "🎁", label: "Gift Cards" },
      { href: "/dashboard/finance",        icon: "💰", label: "Finance" },
    ],
  },
  {
    title: "Analytics",
    items: [
      { href: "/dashboard/reports",        icon: "📊", label: "Sales Reports" },
      { href: "/dashboard/gst-report",     icon: "🧾", label: "GST Report" },
      { href: "/dashboard/staff-report",   icon: "👨‍💼", label: "Staff Performance" },
      { href: "/dashboard/pnl",            icon: "💹", label: "P&L Statement" },
      { href: "/dashboard/activity-log",   icon: "📋", label: "Activity Log" },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/dashboard/users",          icon: "👥", label: "Staff" },
      { href: "/dashboard/attendance",     icon: "⏱️",  label: "Attendance" },
      { href: "/dashboard/permissions",    icon: "🔑", label: "Permissions" },
      { href: "/dashboard/settings",       icon: "⚙️",  label: "Settings & QR" },
      { href: "/dashboard/data-management",icon: "🗃️", label: "Data Management" },
    ],
  },
];

const BOTTOM_NAV = [
  { href: "/dashboard/home",   icon: "🏠", label: "Home" },
  { href: "/dashboard/tables", icon: "🪑", label: "Tables" },
  { href: "/dashboard/orders", icon: "🍳", label: "Kitchen" },
  { href: "/dashboard/bills",  icon: "🧾", label: "Bills" },
  { href: "/dashboard/reports",icon: "📊", label: "Reports" },
];

const allNav = NAV.flatMap(g => g.items);
type User = { name: string; role: string };
type SearchResult = { type: string; label: string; sub: string; id: string };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const muiTheme  = useTheme();
  const isMobile  = useMediaQuery(muiTheme.breakpoints.down("md"));

  const [user, setUser]               = useState<User | null>(null);
  const [allowedPages, setAllowedPages] = useState<string[]>(["*"]);
  const [openSection, setOpenSection] = useState<string>("Operations");
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [query, setQuery]             = useState("");
  const [pendingCount, setPendingCount] = useState<number | undefined>(undefined);
  const [qrPending, setQrPending]     = useState(0);
  const [results, setResults]         = useState<SearchResult[]>([]);
  const [searching, setSearching]     = useState(false);
  const [notifAnchor, setNotifAnchor] = useState<HTMLElement | null>(null);
  const [notifs, setNotifs]           = useState<{id:string;title:string;message:string;type:string;isRead:boolean;createdAt:string}[]>([]);
  const [unread, setUnread]           = useState(0);
  const [bottomNav, setBottomNav]     = useState(0);

  useEffect(() => {
    const active = NAV.find(g => g.items.some(i => pathname.startsWith(i.href)));
    if (active) setOpenSection(active.title);
    const bi = BOTTOM_NAV.findIndex(n => pathname.startsWith(n.href));
    if (bi >= 0) setBottomNav(bi);
  }, [pathname]);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const d = await res.json();
      setResults(d.results ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (!d.user) return;
      setUser(d.user);
      if (d.user.role === "OWNER") {
        setAllowedPages(["*"]);
      } else {
        fetch("/api/permissions").then(r => r.json()).then(p => {
          setAllowedPages(p.permissions?.[d.user.role] ?? []);
        }).catch(() => setAllowedPages(["home","tables","floor","orders","bills"]));
      }
    });
    const loadBadge = () => {
      fetch("/api/orders?status=PENDING").then(r => r.json()).then(d => setPendingCount(d.orders?.length ?? 0)).catch(() => setPendingCount(0));
      fetch("/api/qr/pending").then(r => r.json()).then(d => setQrPending(d.orders?.length ?? 0)).catch(() => setQrPending(0));
    };
    const loadNotifs = () => fetch("/api/notifications").then(r => r.json()).then(d => { setNotifs(d.notifications ?? []); setUnread(d.unreadCount ?? 0); }).catch(() => {});
    loadBadge(); loadNotifs();
    const iv = setInterval(() => { loadBadge(); loadNotifs(); }, 20000);
    return () => clearInterval(iv);
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PUT" });
    setUnread(0); setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function canAccess(href: string) {
    if (allowedPages.includes("*")) return true;
    return allowedPages.includes(href.replace("/dashboard/", ""));
  }

  useEffect(() => {
    if (!user || allowedPages.includes("*")) return;
    const pageId = pathname.replace("/dashboard/", "").split("/")[0];
    if (pageId && pageId !== "home" && !allowedPages.includes(pageId)) router.push("/dashboard/home");
  }, [pathname, allowedPages, user, router]);

  const currentPage = allNav.find(n => pathname.startsWith(n.href));

  /* ── Sidebar content ── */
  const drawerContent = (
    <Box sx={{ display:"flex", flexDirection:"column", height:"100%", bgcolor:"#0F1623" }}>
      {/* Logo */}
      <Box sx={{ px:2.5, py:2, borderBottom:"1px solid #1E2D42" }}>
        <Typography sx={{ color:"#E8721C", fontWeight:800, fontSize:18, letterSpacing:"-0.5px" }}>
          🍽️ RestoBill
        </Typography>
        <Typography sx={{ color:"#3A4A62", fontSize:11, mt:0.3 }}>Restaurant POS</Typography>
      </Box>

      {/* Nav */}
      <Box sx={{ flex:1, overflowY:"auto", py:1,
        "&::-webkit-scrollbar":{ width:4 },
        "&::-webkit-scrollbar-thumb":{ background:"#1E2D42", borderRadius:4 },
      }}>
        {NAV.map(group => {
          const visible = group.items.filter(i => canAccess(i.href));
          if (!visible.length) return null;
          const isOpen   = openSection === group.title;
          const hasActive = visible.some(i => pathname.startsWith(i.href));

          return (
            <Box key={group.title}>
              <ListItemButton
                onClick={() => setOpenSection(isOpen ? "" : group.title)}
                sx={{
                  py:0.9, px:2, mx:0,
                  "& .MuiListItemText-primary": {
                    fontSize:10, fontWeight:700, letterSpacing:.8,
                    textTransform:"uppercase",
                    color: hasActive ? "#E8721C" : "#4A5A72",
                  },
                  borderLeft: hasActive && !isOpen ? "2px solid #E8721C" : "2px solid transparent",
                  borderRadius:0, mr:0,
                  "&:hover":{ background:"rgba(255,255,255,0.04)" },
                }}
              >
                <ListItemText primary={group.title} />
                <Typography sx={{ fontSize:9, color:"#4A5A72", opacity:.7 }}>{isOpen?"▲":"▼"}</Typography>
              </ListItemButton>

              <Collapse in={isOpen} timeout={200}>
                <List disablePadding>
                  {visible.map(item => {
                    const active = pathname.startsWith(item.href);
                    const cnt    = item.href.includes("qr-orders") ? qrPending : pendingCount;
                    return (
                      <ListItemButton
                        key={item.href}
                        component={Link}
                        href={item.href}
                        selected={active}
                        onClick={() => isMobile && setMobileOpen(false)}
                        sx={{ py:0.85, pl:2.5, pr:1 }}
                      >
                        <ListItemIcon sx={{ minWidth:32 }}>
                          <Typography sx={{ fontSize:15 }}>{item.icon}</Typography>
                        </ListItemIcon>
                        <ListItemText
                          primary={item.label}
                          slotProps={{ primary: { style: { fontSize:12.5, fontWeight: active ? 700 : 400, color: active ? "#E8721C" : "#94A3B8" } } }}
                        />
                        {item.badge && <NotificationBadge count={cnt} showDot={cnt === 0} ariaLabel={`${cnt??0} pending`} />}
                      </ListItemButton>
                    );
                  })}
                </List>
              </Collapse>
            </Box>
          );
        })}
      </Box>

      {/* User + Logout */}
      <Box sx={{ borderTop:"1px solid #1E2D42", p:2 }}>
        {user && (
          <Box sx={{ mb:1.5, display:"flex", alignItems:"center", gap:1.5 }}>
            <Avatar sx={{ width:32, height:32, bgcolor:"#E8721C", fontSize:13, fontWeight:800 }}>
              {user.name?.[0]?.toUpperCase()}
            </Avatar>
            <Box sx={{ overflow:"hidden" }}>
              <Typography sx={{ fontSize:12, fontWeight:700, color:"#CBD5E1", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.name}</Typography>
              <Chip label={user.role} size="small" sx={{ fontSize:9, height:16, bgcolor:"rgba(232,114,28,0.15)", color:"#E8721C", fontWeight:700, "& .MuiChip-label":{px:1} }} />
            </Box>
          </Box>
        )}
        <ListItemButton
          onClick={logout}
          sx={{ borderRadius:2, py:0.75, justifyContent:"center", gap:1,
            bgcolor:"#1E2D42", color:"#94A3B8", fontSize:12,
            "&:hover":{ bgcolor:"#DC2626", color:"#fff" },
          }}
        >
          <Typography sx={{ fontSize:14 }}>🚪</Typography>
          <Typography sx={{ fontSize:12, fontWeight:600 }}>Logout</Typography>
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display:"flex", minHeight:"100vh", bgcolor:"background.default" }}>

      {/* Desktop permanent drawer */}
      {!isMobile && (
        <Drawer variant="permanent" sx={{
          width:DRAWER_W, flexShrink:0,
          "& .MuiDrawer-paper":{ width:DRAWER_W, boxSizing:"border-box" },
        }}>
          {drawerContent}
        </Drawer>
      )}

      {/* Mobile swipeable drawer */}
      {isMobile && (
        <SwipeableDrawer
          open={mobileOpen}
          onOpen={() => setMobileOpen(true)}
          onClose={() => setMobileOpen(false)}
          sx={{ "& .MuiDrawer-paper":{ width:DRAWER_W } }}
        >
          {drawerContent}
        </SwipeableDrawer>
      )}

      {/* Main */}
      <Box sx={{ flex:1, display:"flex", flexDirection:"column", minWidth:0,
        ml: isMobile ? 0 : 0,
      }}>

        {/* AppBar */}
        <AppBar position="sticky" elevation={0} sx={{ zIndex:30 }}>
          <Toolbar sx={{ gap:1.5, minHeight:"56px!important", px: { xs:1.5, md:3 } }}>

            {/* Hamburger (mobile) */}
            {isMobile && (
              <IconButton onClick={() => setMobileOpen(true)} edge="start" sx={{ mr:0.5, color:"inherit" }}>
                <Typography sx={{ fontSize:20 }}>☰</Typography>
              </IconButton>
            )}

            <Typography variant="subtitle1" sx={{ fontWeight:700, mr:"auto", fontSize:{ xs:13, md:15 }, whiteSpace:"nowrap" }}>
              {currentPage?.icon} {currentPage?.label ?? "Dashboard"}
            </Typography>

            {/* Search (hidden on xs, shown from sm) */}
            <Paper elevation={0} sx={{
              display:{ xs:"none", sm:"flex" }, alignItems:"center",
              border:"1px solid #E2E8F0", borderRadius:3, px:1.5, py:0.4, width:{ sm:160, md:210 },
              position:"relative",
            }}>
              <Typography sx={{ fontSize:13, mr:1, opacity:.5 }}>🔍</Typography>
              <InputBase
                value={query}
                onChange={e => setQuery(e.target.value)}
                onBlur={() => setTimeout(() => setQuery(""), 200)}
                placeholder="Search…"
                sx={{ fontSize:13, flex:1 }}
              />
              {(searching || results.length > 0) && (
                <Paper elevation={4} sx={{
                  position:"absolute", top:"calc(100% + 6px)", right:0,
                  width:310, zIndex:300, borderRadius:2, overflow:"hidden",
                }}>
                  {searching && <Typography sx={{ p:2, fontSize:12, color:"text.secondary" }}>Searching…</Typography>}
                  {results.map((r,i) => (
                    <Box key={i} onMouseDown={() => setQuery("")} sx={{
                      px:2, py:1.25, cursor:"pointer", borderBottom:"1px solid #F1F5F9",
                      "&:hover":{ bgcolor:"#F8FAFC" },
                    }}>
                      <Typography sx={{ fontSize:12, fontWeight:600 }}>{r.label}</Typography>
                      <Typography sx={{ fontSize:11, color:"text.secondary" }}>{r.type} · {r.sub}</Typography>
                    </Box>
                  ))}
                </Paper>
              )}
            </Paper>

            {/* Date */}
            <Typography sx={{ fontSize:12, color:"text.secondary", display:{ xs:"none", md:"block" }, whiteSpace:"nowrap" }}>
              {new Date().toLocaleDateString("en-IN", { day:"numeric", month:"short" })}
            </Typography>

            {/* Notifications */}
            <IconButton
              onClick={e => { setNotifAnchor(e.currentTarget); if (unread>0) markAllRead(); }}
              sx={{ border:"1px solid #E2E8F0", borderRadius:2, p:0.8 }}
            >
              <Badge badgeContent={unread||null} color="error" sx={{ "& .MuiBadge-badge":{ fontSize:9, minWidth:16, height:16 } }}>
                <Typography sx={{ fontSize:16, lineHeight:1 }}>🔔</Typography>
              </Badge>
            </IconButton>

            {/* Notif popover */}
            <Popover
              open={Boolean(notifAnchor)}
              anchorEl={notifAnchor}
              onClose={() => setNotifAnchor(null)}
              anchorOrigin={{ vertical:"bottom", horizontal:"right" }}
              transformOrigin={{ vertical:"top", horizontal:"right" }}
              slotProps={{ paper: { sx:{ width:320, borderRadius:2, mt:0.5 } } }}
            >
              <Box sx={{ px:2, py:1.5, display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:"1px solid #F1F5F9" }}>
                <Typography sx={{ fontWeight:700, fontSize:13 }}>Notifications</Typography>
                <Typography onClick={markAllRead} sx={{ fontSize:11, color:"primary.main", cursor:"pointer", fontWeight:600 }}>Mark all read</Typography>
              </Box>
              <Box sx={{ maxHeight:340, overflowY:"auto" }}>
                {notifs.length === 0
                  ? <Typography sx={{ p:3, textAlign:"center", color:"text.secondary", fontSize:13 }}>No notifications</Typography>
                  : notifs.map(n => (
                    <Box key={n.id} sx={{
                      px:2, py:1.25, borderBottom:"1px solid #F8FAFC",
                      bgcolor: n.isRead ? "white" : "#FFF7ED",
                      display:"flex", gap:1.5, alignItems:"flex-start",
                    }}>
                      <Typography sx={{ fontSize:15, flexShrink:0 }}>
                        {n.type==="ERROR"?"🔴":n.type==="SUCCESS"?"✅":n.type==="WARNING"?"⚠️":"ℹ️"}
                      </Typography>
                      <Box sx={{ flex:1, minWidth:0 }}>
                        <Typography sx={{ fontWeight:600, fontSize:12, mb:0.25 }}>{n.title}</Typography>
                        <Typography sx={{ fontSize:11, color:"text.secondary", lineHeight:1.45 }}>{n.message}</Typography>
                        <Typography sx={{ fontSize:10, color:"#CBD5E1", mt:0.5 }}>
                          {new Date(n.createdAt).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}
                        </Typography>
                      </Box>
                      {!n.isRead && <Box sx={{ width:6, height:6, borderRadius:"50%", bgcolor:"primary.main", flexShrink:0, mt:0.5 }} />}
                    </Box>
                  ))
                }
              </Box>
            </Popover>

            {/* Role badge */}
            {user && (
              <Chip
                label={user.role}
                size="small"
                sx={{ bgcolor:"#FFF0E5", color:"#E8721C", fontWeight:700, fontSize:10, display:{ xs:"none", sm:"flex" } }}
              />
            )}
          </Toolbar>
        </AppBar>

        {/* Page content */}
        <Box component="main" sx={{ flex:1, p:{ xs:1.5, sm:2, md:3 }, pb: isMobile ? 10 : 3 }}>
          {children}
        </Box>

        {/* Mobile bottom navigation */}
        {isMobile && (
          <BottomNavigation
            value={bottomNav}
            onChange={(_, v) => { setBottomNav(v); router.push(BOTTOM_NAV[v].href); }}
            sx={{ position:"fixed", bottom:0, left:0, right:0, zIndex:50 }}
          >
            {BOTTOM_NAV.map(n => (
              <BottomNavigationAction
                key={n.href}
                label={n.label}
                icon={<Typography sx={{ fontSize:20 }}>{n.icon}</Typography>}
                sx={{ "& .MuiBottomNavigationAction-label":{ fontSize:"10px!important", color:"inherit" } }}
              />
            ))}
          </BottomNavigation>
        )}
      </Box>

      <ToastContainer />
      <AIAssistant />
    </Box>
  );
}
