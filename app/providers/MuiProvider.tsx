"use client";

import { ThemeProvider } from "@mui/material/styles";
import type { ReactNode } from "react";
import { muiTheme } from "./muiTheme";

export default function MuiProvider({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={muiTheme}>{children}</ThemeProvider>;
}
