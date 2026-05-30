"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScrollText, Settings, ShieldCheck } from "lucide-react";
import { logout } from "@/lib/auth";
import { getDashboardStats } from "@/lib/admin/dashboard";
import { fetchAnalyticsOverview } from "@/lib/admin/analytics";
import type { AnalyticsOverview, DashboardAppointmentRow, DashboardChartPoint, DashboardStats } from "@/lib/admin/types";
import { ROUTES } from "@/lib/routes";
import ThemeToggleButton from "@/components/ui/ThemeToggleButton";

function ChartSkeleton() {
  return <div className="h-[180px] rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />;
}

const DashboardRevenueChart = dynamic(
  () => import("@/components/admin/DashboardRevenueChart"),
  { ssr: false, loading: ChartSkeleton }
);

const DashboardAppointmentsChart = dynamic(
  () => import("@/components/admin/DashboardAppointmentsChart"),
  { ssr: false, loading: ChartSkeleton }
);

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  done: { label: "Выполнено", cls: "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400" },
  current: { label: "Сейчас", cls: "bg-primary-light text-primary" },
  upcoming: { label: "Ожидает", cls: "bg-primary/10 text-primary" },
};

function formatRub(n: number): string {
  return n.toLocaleString("ru-RU");
}

function buildStatCards(stats: DashboardStats, analytics: AnalyticsOverview | null) {
  return [
    {
      label: "Выручка, ₽",
      value: formatRub(stats.revenueMonth),
      sub: `${stats.paymentsMonth} оплат · из payments`,
      color: "bg-primary-light",
      textColor: "text-primary",
      href: "/screens/admin/finance",
    },
    {
      label: "Дебиторка",
      value: formatRub(stats.pendingDebt),
      sub: "неоплаченные счета",
      color: "bg-primary/10",
      textColor: "text-primary",
      href: "/screens/admin/finance",
    },
    {
      label: "Пациентов",
      value: analytics ? String(analytics.totalPatients) : "—",
      sub: analytics ? `+${analytics.newPatientsMonth} новых · ${analytics.atRiskCount} at risk` : "аналитика",
      color: "bg-slate-100 dark:bg-slate-800",
      textColor: "text-[#0F172A] dark:text-white",
      href: "/screens/admin/analytics",
    },
    {
      label: "KPI врачей",
      value: analytics?.topDoctorName.split(" ")[0] ?? "→",
      sub: analytics
        ? `${formatRub(analytics.topDoctorRevenueMonth)} ₽ · ${analytics.avgCompletionRate}% завершений`
        : "аналитика и экспорт",
      color: "bg-primary-light",
      textColor: "text-primary",
      href: "/screens/admin/analytics",
    },
    {
      label: "CRM",
      value: "→",
      sub: "сегменты и возврат в Telegram",
      color: "bg-primary/10",
      textColor: "text-primary",
      href: "/screens/admin/crm",
    },
  ];
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [chart, setChart] = useState<DashboardChartPoint[]>([]);
  const [today, setToday] = useState<DashboardAppointmentRow[]>([]);
  const [dashLoading, setDashLoading] = useState(true);
  const [dashError, setDashError] = useState("");

  const statCards = useMemo(
    () => (stats ? buildStatCards(stats, analytics) : []),
    [stats, analytics],
  );
  const chartData = useMemo(() => chart, [chart]);

  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    const [res, analyticsRes] = await Promise.all([getDashboardStats(), fetchAnalyticsOverview()]);
    setStats(res.stats);
    setChart(res.chart);
    setToday(res.today);
    setAnalytics(analyticsRes.overview);
    setDashError(res.error ?? analyticsRes.error ?? "");
    setDashLoading(false);
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleLogout = () => {
    logout();
    router.replace(ROUTES.auth);
  };

  return (
    <main className="min-h-dvh bg-surface dark:bg-app-canvas pb-safe">
      <div className="px-5 pt-[calc(env(safe-area-inset-top,0px)+3rem)] pb-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-medium text-secondary uppercase tracking-widest mb-1">Панель администратора</p>
            <h1 className="text-[24px] font-bold text-[#0F172A] dark:text-white">Дашборд</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggleButton sizeClass="w-9 h-9" />
            <button
              type="button"
              onClick={handleLogout}
              className="interactive-press-sm w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-raised-surface"
              title="Выйти"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M9 21H5C4.44772 21 4 20.5523 4 20V4C4 3.44772 4.44772 3 5 3H9" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M16 17L21 12M21 12L16 7M21 12H9" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <Link
          href={ROUTES.adminAnalytics}
          className="interactive-press-sm mt-4 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary-light/60 px-4 py-3 dark:border-primary/30 dark:bg-primary/10"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-900 text-primary">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 19V5M4 19H20M4 19L8 15M20 19V9M20 9H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-[#0F172A] dark:text-white">KPI и аналитика</span>
            <span className="block text-[12px] text-secondary">Врачи · пациенты · экспорт CSV</span>
          </span>
          <span className="text-primary text-[13px] font-semibold shrink-0">Открыть</span>
        </Link>

        <Link
          href={ROUTES.adminLogs}
          className="interactive-press-sm mt-4 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary-light/60 px-4 py-3 dark:border-primary/30 dark:bg-primary/10"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-900 text-primary">
            <ScrollText className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-[#0F172A] dark:text-white">Логи системы</span>
            <span className="block text-[12px] text-secondary">Supabase · фильтр по уровню · экспорт JSON</span>
          </span>
          <span className="text-primary text-[13px] font-semibold shrink-0">Открыть</span>
        </Link>

        <Link
          href={ROUTES.adminSettings}
          className="interactive-press-sm mt-3 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary-light/60 px-4 py-3 dark:border-primary/30 dark:bg-primary/10"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-900 text-primary">
            <Settings className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-[#0F172A] dark:text-white">Настройки клиники</span>
            <span className="block text-[12px] text-secondary">Брендинг · контакты · цвет</span>
          </span>
          <span className="text-primary text-[13px] font-semibold shrink-0">Открыть</span>
        </Link>

        <Link
          href={ROUTES.adminAudit}
          className="interactive-press-sm mt-3 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary-light/60 px-4 py-3 dark:border-primary/30 dark:bg-primary/10"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-900 text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-[#0F172A] dark:text-white">Audit Trail</span>
            <span className="block text-[12px] text-secondary">Мед. данные · кто изменил · diff</span>
          </span>
          <span className="text-primary text-[13px] font-semibold shrink-0">Открыть</span>
        </Link>
      </div>

      {dashError ? (
        <p className="px-5 text-[13px] text-red-600 dark:text-red-400 mb-2">{dashError}</p>
      ) : null}

      <div className="px-5 grid grid-cols-2 gap-3 mb-4">
        {dashLoading || !stats
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl p-4 h-[88px] bg-slate-100 dark:bg-slate-800 animate-pulse border border-slate-200/80 dark:border-slate-700/50"
              />
            ))
          : statCards.map((s) => {
              const inner = (
                <>
                  <p className={`text-[22px] font-bold ${s.textColor} leading-none tabular-nums`}>{s.value}</p>
                  <p className="text-[12px] font-semibold text-[#0F172A] dark:text-white mt-1 leading-tight">{s.label}</p>
                  <p className="text-[11px] text-secondary mt-0.5">{s.sub}</p>
                </>
              );
              return "href" in s && s.href ? (
                <Link
                  key={s.label}
                  href={s.href}
                  className={`interactive-press-sm rounded-2xl p-4 shadow-[0_4px_14px_rgba(15,23,42,0.07)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.35)] border border-slate-200/80 dark:border-slate-700/50 ${s.color}`}
                >
                  {inner}
                </Link>
              ) : (
                <div
                  key={s.label}
                  className={`rounded-2xl p-4 shadow-[0_4px_14px_rgba(15,23,42,0.07)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.35)] border border-slate-200/80 dark:border-slate-700/50 ${s.color}`}
                >
                  {inner}
                </div>
              );
            })}
      </div>

      <div className="px-5 mb-4 space-y-3">
        <ChartCard title="Выручка по дням (месяц)" loading={dashLoading}>
          {!dashLoading && <DashboardRevenueChart data={chartData} />}
        </ChartCard>

        <ChartCard title="Записи по дням (месяц)" loading={dashLoading}>
          {!dashLoading && <DashboardAppointmentsChart data={chartData} />}
        </ChartCard>
      </div>

      <div className="px-5">
        <h2 className="text-[16px] font-bold text-[#0F172A] dark:text-white mb-3">Расписание на сегодня</h2>
        <div className="flex flex-col gap-2">
          {dashLoading ? (
            <p className="text-[13px] text-secondary py-6 text-center">Загрузка расписания…</p>
          ) : today.length === 0 ? (
            <p className="text-[13px] text-secondary py-6 text-center">На сегодня записей нет</p>
          ) : (
            today.map((a) => {
              const { label, cls } = STATUS_MAP[a.status] ?? STATUS_MAP.upcoming;
              return (
                <div
                  key={a.id}
                  className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-start gap-3 shadow-[0_4px_16px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.32)] ${
                    a.status === "current" ? "ring-1 ring-primary" : ""
                  }`}
                >
                  <div className="min-w-[44px] text-center">
                    <span className="text-[15px] font-bold text-[#0F172A] dark:text-white">{a.time}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#0F172A] dark:text-white truncate">{a.patient}</p>
                    <p className="text-[12px] text-secondary truncate">
                      {a.doctor} · {a.procedure}
                    </p>
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-1 rounded-lg shrink-0 ${cls}`}>{label}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}

function ChartCard({
  title,
  loading,
  children,
}: {
  title: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
      <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white mb-2">{title}</p>
      {loading ? (
        <div className="h-[180px] rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
      ) : (
        children
      )}
    </div>
  );
}
