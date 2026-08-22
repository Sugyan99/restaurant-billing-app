"use client";

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TrendingUp from "@mui/icons-material/TrendingUp";

export default function MuiKpiCard({
  label,
  value,
  trend,
}: {
  label: string;
  value: string | number;
  trend?: { value: string; up: boolean } | null;
}) {
  return (
    <Card sx={{ height: "100%", borderRadius: 1.5 }}>
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography variant="h5" sx={{ fontWeight: 900, color: "primary.main" }}>
            {value}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {label}
          </Typography>
          {trend && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, pt: 0.25 }}>
              <TrendingUp
                sx={{
                  fontSize: 14,
                  color: trend.up ? "success.main" : "error.main",
                  transform: trend.up ? "none" : "rotate(180deg)",
                }}
              />
              <Typography
                variant="caption"
                sx={{ fontWeight: 600, color: trend.up ? "success.main" : "error.main" }}
              >
                {trend.value}% vs yesterday
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
