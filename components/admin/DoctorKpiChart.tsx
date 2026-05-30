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
import type { DoctorKpiRow } from "@/lib/admin/types";
import { dashboardChartTooltipProps } from "@/components/admin/dashboardChartTooltip";

function formatRub(n: number): string {
  return n.toLocaleString("ru-RU");
}

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0]} ${parts[1][0] ?? ""}.`;
  return name.slice(0, 12);
}

function DoctorKpiChart({ data }: { data: DoctorKpiRow[] }) {
  const chartData = data.slice(0, 6).map((d) => ({
    label: shortName(d.doctorName),
    revenue: d.revenueMonth,
    appointments: d.appointmentsMonth,
  }));

  if (chartData.length === 0) {
    return (
      <p className="text-[13px] text-secondary py-8 text-center">Нет данных по врачам</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={48} />
        <YAxis tick={{ fontSize: 10 }} width={42} />
        <Tooltip
          {...dashboardChartTooltipProps}
          formatter={(v, name) => {
            if (name === "revenue") return [`${formatRub(Number(v))} ₽`, "Выручка"];
            return [String(v), "Записей"];
          }}
        />
        <Bar dataKey="revenue" fill="#248BCF" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default memo(DoctorKpiChart);
