import { createTheme } from "@mui/material/styles";

export const muiTheme = createTheme({
  palette: {
    primary: {
      main: "#E8721C",
      light: "#FFF0E5",
      dark: "#C45A0E",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#253045",
      light: "#3A4A62",
      dark: "#0F1623",
      contrastText: "#FFFFFF",
    },
    success: { main: "#16A34A" },
    error: { main: "#DC2626" },
    warning: { main: "#D97706" },
    background: {
      default: "#FFFBF7",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#0F1623",
      secondary: "#3A4A62",
    },
    divider: "#E2E8F0",
  },
  typography: {
    fontFamily: "Inter, system-ui, sans-serif",
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          border: "1px solid #E2E8F0",
          boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
        },
      },
    },
  },
});
