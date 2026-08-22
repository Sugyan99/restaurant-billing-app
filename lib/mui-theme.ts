"use client";
import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",
    primary:   { main: "#E8721C", light: "#F59E0B", dark: "#C45A0E", contrastText: "#fff" },
    secondary: { main: "#6366F1", contrastText: "#fff" },
    success:   { main: "#16A34A" },
    error:     { main: "#DC2626" },
    warning:   { main: "#D97706" },
    info:      { main: "#2563EB" },
    background:{ default: "#F8FAFC", paper: "#FFFFFF" },
    text:      { primary: "#0F1623", secondary: "#64748B" },
  },
  typography: {
    fontFamily: "'Inter', system-ui, sans-serif",
    h1: { fontWeight: 800 },
    h2: { fontWeight: 800 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    button: { fontWeight: 700, textTransform: "none" },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10, fontWeight: 700, boxShadow: "none", "&:hover": { boxShadow: "none" } },
        contained: {
          background: "linear-gradient(135deg,#E8721C,#C45A0E)",
          "&:hover": { background: "linear-gradient(135deg,#F07E30,#D4620F)" },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          border: "1px solid #E2E8F0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: "#0F1623",
          color: "#fff",
          border: "none",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: "#FFFFFF",
          color: "#0F1623",
          boxShadow: "0 1px 0 #E2E8F0",
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: "0 10px 10px 0",
          marginRight: 8,
          "&.Mui-selected": {
            background: "rgba(232,114,28,0.12)",
            color: "#E8721C",
            borderLeft: "3px solid #E8721C",
            "& .MuiListItemIcon-root": { color: "#E8721C" },
            "&:hover": { background: "rgba(232,114,28,0.18)" },
          },
          "&:hover": { background: "rgba(255,255,255,0.07)", color: "#fff" },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: { root: { minWidth: 36, color: "#94A3B8" } },
    },
    MuiTextField: {
      styleOverrides: {
        root: { "& .MuiOutlinedInput-root": { borderRadius: 10 } },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: { background: "#0F1623", borderTop: "1px solid #1E2D42", height: 60 },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          color: "#4A5A72",
          "&.Mui-selected": { color: "#E8721C" },
          minWidth: 0, padding: "6px 0",
        },
      },
    },
  },
});

export default theme;
