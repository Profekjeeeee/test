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
import type { CrmSegmentStat } from "@/lib/admin/types";
import { dashboardChartTooltipProps } from "@/components/admin/dashboardChartTooltip";

function PatientSegmentChart({ data }: { data: CrmSegmentStat[] }) {
  const chartData = data.filter((d) => d.count > 0).map((d) => ({
    label: d.label,
    count: d.count,
  }));

  if (chartData.length === 0) {
    return (
      <p className="text-[13px] text-secondary py-8 text-center">Нет данных по сегментам</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
        <XAxis type="number" tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={72} />
        <Tooltip
          {...dashboardChartTooltipProps}
          formatter={(v) => [String(v), "Пациентов"]}
        />
        <Bar dataKey="count" fill="#248BCF" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default memo(PatientSegmentChart);
