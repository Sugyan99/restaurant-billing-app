"use client";

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
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
        <Stack spacing={0.5}>
          <Typography variant="h5" component="div" fontWeight={900} color="primary.main">
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
          {trend && (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ pt: 0.25 }}>
              <TrendingUp
                sx={{
                  fontSize: 14,
                  color: trend.up ? "success.main" : "error.main",
                  transform: trend.up ? "none" : "rotate(180deg)",
                }}
              />
              <Typography
                variant="caption"
                fontWeight={600}
                color={trend.up ? "success.main" : "error.main"}
              >
                {trend.value}% vs yesterday
              </Typography>
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
