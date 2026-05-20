"use client";

import { memo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardChartPoint } from "@/lib/admin/types";
import { dashboardChartTooltipProps } from "@/components/admin/dashboardChartTooltip";

function DashboardAppointmentsChart({ data }: { data: DashboardChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
        <Tooltip
          {...dashboardChartTooltipProps}
          labelFormatter={(l) => `День ${l}`}
          formatter={(v) => [String(v), "Записи"]}
        />
        <Line type="monotone" dataKey="appointments" stroke="#248BCF" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default memo(DashboardAppointmentsChart);
