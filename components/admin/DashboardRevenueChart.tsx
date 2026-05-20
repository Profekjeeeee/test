"use client";

import { memo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardChartPoint } from "@/lib/admin/types";
import { dashboardChartTooltipProps } from "@/components/admin/dashboardChartTooltip";

function formatRub(n: number): string {
  return n.toLocaleString("ru-RU");
}

function DashboardRevenueChart({ data }: { data: DashboardChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} width={42} />
        <Tooltip
          {...dashboardChartTooltipProps}
          formatter={(v) => [`${formatRub(Number(v))} ₽`, "Выручка"]}
          labelFormatter={(l) => `День ${l}`}
        />
        <Bar dataKey="revenue" fill="#248BCF" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default memo(DashboardRevenueChart);
