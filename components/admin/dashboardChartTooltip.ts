/** Общие стили Tooltip Recharts — светлая/тёмная тема через CSS-переменные в globals.css */
export const dashboardChartTooltipProps = {
  contentStyle: {
    backgroundColor: "var(--chart-tooltip-bg)",
    border: "1px solid var(--chart-tooltip-border)",
    borderRadius: 10,
    padding: "8px 12px",
    boxShadow: "var(--chart-tooltip-shadow)",
  },
  labelStyle: {
    color: "var(--chart-tooltip-label)",
    fontWeight: 600,
    fontSize: 12,
    marginBottom: 4,
  },
  itemStyle: {
    color: "var(--chart-tooltip-value)",
    fontSize: 12,
    padding: 0,
  },
  cursor: { fill: "var(--chart-tooltip-cursor)" },
} as const;
