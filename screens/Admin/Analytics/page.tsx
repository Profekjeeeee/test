"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import ThemeToggleButton from "@/components/ui/ThemeToggleButton";
import {
  exportAnalyticsCsv,
  fetchDoctorKpiList,
  fetchPatientAnalyticsSummary,
  fetchTopPatientsByLtv,
  refreshAllAnalytics,
  SEGMENT_LABELS,
} from "@/lib/admin/analytics";
import type {
  CrmPatientRow,
  CrmSegmentStat,
  DoctorKpiRow,
  PatientAnalyticsSummary,
  PatientSegmentKey,
} from "@/lib/admin/types";
import { ROUTES } from "@/lib/routes";
import { tgHapticSuccess } from "@/lib/telegramHaptic";

function ChartSkeleton() {
  return <div className="h-[180px] rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />;
}

const DoctorKpiChart = dynamic(
  () => import("@/components/admin/DoctorKpiChart"),
  { ssr: false, loading: ChartSkeleton },
);

const PatientSegmentChart = dynamic(
  () => import("@/components/admin/PatientSegmentChart"),
  { ssr: false, loading: ChartSkeleton },
);

type Tab = "overview" | "doctors" | "patients";

const SEGMENT_CLS: Record<PatientSegmentKey, string> = {
  new: "bg-slate-100 dark:bg-slate-800 text-[#0F172A] dark:text-white",
  active: "bg-primary-light text-primary",
  at_risk: "bg-primary/10 text-primary",
  dormant: "bg-slate-200 dark:bg-slate-700 text-[#0F172A] dark:text-white",
  high_value: "bg-sky-100 dark:bg-primary/15 text-primary",
  debtor: "bg-primary/15 text-primary",
};

function formatRub(n: number): string {
  return n.toLocaleString("ru-RU");
}

export default function AdminAnalyticsPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [doctors, setDoctors] = useState<DoctorKpiRow[]>([]);
  const [summary, setSummary] = useState<PatientAnalyticsSummary | null>(null);
  const [segments, setSegments] = useState<CrmSegmentStat[]>([]);
  const [topPatients, setTopPatients] = useState<CrmPatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [docRes, patRes, topRes] = await Promise.all([
      fetchDoctorKpiList(),
      fetchPatientAnalyticsSummary(),
      fetchTopPatientsByLtv(15),
    ]);
    setDoctors(docRes.data);
    setSummary(patRes.summary);
    setSegments(patRes.segments);
    setTopPatients(topRes.data);
    setError(docRes.error ?? patRes.error ?? topRes.error ?? "");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const overviewCards = useMemo(() => {
    if (!summary) return [];
    const topDoctor = doctors[0];
    return [
      {
        label: "Пациентов",
        value: String(summary.totalPatients),
        sub: `+${summary.newPatientsMonth} новых в месяце`,
      },
      {
        label: "Средний LTV",
        value: `${formatRub(summary.avgLtv)} ₽`,
        sub: `${summary.avgVisits} визитов в среднем`,
      },
      {
        label: "Риск ухода",
        value: String(summary.atRiskCount),
        sub: `${summary.dormantCount} спящих`,
      },
      {
        label: "Топ врач",
        value: topDoctor?.doctorName.split(" ")[0] ?? "—",
        sub: topDoctor ? `${formatRub(topDoctor.revenueMonth)} ₽ за месяц` : "нет данных",
      },
    ];
  }, [summary, doctors]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const res = await refreshAllAnalytics();
    setRefreshing(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    tgHapticSuccess();
    setError("");
    await load();
  };

  const handleExport = () => {
    const csv = exportAnalyticsCsv(doctors, topPatients, segments);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    tgHapticSuccess();
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Обзор" },
    { id: "doctors", label: "Врачи" },
    { id: "patients", label: "Пациенты" },
  ];

  return (
    <main className="min-h-dvh bg-surface dark:bg-app-canvas pb-safe">
      <div className="px-5 pt-[calc(env(safe-area-inset-top,0px)+3rem)] pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Link href={ROUTES.adminDashboard} className="text-[12px] text-secondary mb-1 block">
              ← Дашборд
            </Link>
            <p className="text-[12px] font-medium text-secondary uppercase tracking-widest mb-1">
              Аналитика
            </p>
            <h1 className="text-[24px] font-bold text-[#0F172A] dark:text-white">KPI и отчёты</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExport}
              disabled={loading}
              className="interactive-press-sm rounded-xl border border-primary/30 bg-primary-light px-3 py-2 text-[12px] font-semibold text-primary disabled:opacity-50"
            >
              CSV
            </button>
            <ThemeToggleButton sizeClass="w-9 h-9" />
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`interactive-press-sm shrink-0 rounded-xl px-4 py-2 text-[13px] font-semibold ${
                tab === t.id
                  ? "bg-primary text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-secondary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="px-5 text-[13px] text-red-600 dark:text-red-400 mb-2">{error}</p>
      ) : null}

      <div className="px-5 mb-4">
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={refreshing || loading}
          className="interactive-press-sm w-full rounded-2xl border border-primary/25 bg-primary-light/50 py-3 text-[13px] font-semibold text-primary disabled:opacity-50"
        >
          {refreshing ? "Пересчёт метрик…" : "Обновить метрики врачей и пациентов"}
        </button>
      </div>

      {tab === "overview" && (
        <>
          <div className="px-5 grid grid-cols-2 gap-3 mb-4">
            {loading || !summary
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl p-4 h-[88px] bg-slate-100 dark:bg-slate-800 animate-pulse border border-slate-200/80"
                  />
                ))
              : overviewCards.map((c) => (
                  <div
                    key={c.label}
                    className="rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/50 bg-white dark:bg-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.07)]"
                  >
                    <p className="text-[22px] font-bold text-[#0F172A] dark:text-white tabular-nums">{c.value}</p>
                    <p className="text-[12px] font-semibold text-[#0F172A] dark:text-white mt-1">{c.label}</p>
                    <p className="text-[11px] text-secondary mt-0.5">{c.sub}</p>
                  </div>
                ))}
          </div>

          <div className="px-5 space-y-3 mb-4">
            <ChartCard title="Выручка по врачам (месяц)" loading={loading}>
              {!loading && <DoctorKpiChart data={doctors} />}
            </ChartCard>
            <ChartCard title="Сегменты пациентов" loading={loading}>
              {!loading && <PatientSegmentChart data={segments} />}
            </ChartCard>
          </div>
        </>
      )}

      {tab === "doctors" && (
        <div className="px-5">
          {loading ? (
            <p className="text-[13px] text-secondary py-6 text-center">Загрузка…</p>
          ) : doctors.length === 0 ? (
            <p className="text-[13px] text-secondary py-6 text-center">
              Нет KPI. Нажмите «Обновить метрики».
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {doctors.map((d) => (
                <div
                  key={d.doctorKey}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)]"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-[#0F172A] dark:text-white truncate">
                        {d.doctorName}
                      </p>
                      <p className="text-[12px] text-secondary">{d.specialization || "Стоматолог"}</p>
                    </div>
                    <span className="text-[14px] font-bold text-primary tabular-nums shrink-0">
                      {formatRub(d.revenueMonth)} ₽
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[16px] font-bold text-[#0F172A] dark:text-white">{d.appointmentsMonth}</p>
                      <p className="text-[10px] text-secondary">записей</p>
                    </div>
                    <div>
                      <p className="text-[16px] font-bold text-[#0F172A] dark:text-white">{d.completedMonth}</p>
                      <p className="text-[10px] text-secondary">завершено</p>
                    </div>
                    <div>
                      <p className="text-[16px] font-bold text-[#0F172A] dark:text-white">{d.completionRate}%</p>
                      <p className="text-[10px] text-secondary">конверсия</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "patients" && (
        <div className="px-5 space-y-4">
          {!loading && summary ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white mb-3">Сводка</p>
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div>
                  <span className="text-secondary">VIP: </span>
                  <span className="font-semibold text-[#0F172A] dark:text-white">{summary.highValueCount}</span>
                </div>
                <div>
                  <span className="text-secondary">Telegram: </span>
                  <span className="font-semibold text-[#0F172A] dark:text-white">{summary.withTelegram}</span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {segments.map((s) => (
                  <span
                    key={s.segment}
                    className={`text-[11px] font-medium px-2 py-1 rounded-lg ${SEGMENT_CLS[s.segment]}`}
                  >
                    {s.label}: {s.count}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <h2 className="text-[16px] font-bold text-[#0F172A] dark:text-white mb-3">Топ по LTV</h2>
            {loading ? (
              <p className="text-[13px] text-secondary py-4 text-center">Загрузка…</p>
            ) : topPatients.length === 0 ? (
              <p className="text-[13px] text-secondary py-4 text-center">Нет данных</p>
            ) : (
              <div className="flex flex-col gap-2">
                {topPatients.map((p) => (
                  <div
                    key={p.patientId}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-[#0F172A] dark:text-white truncate">{p.name}</p>
                      <p className="text-[12px] text-secondary">
                        {p.totalVisits} визитов · {SEGMENT_LABELS[p.segment]}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[14px] font-bold text-primary tabular-nums">{formatRub(p.totalPaid)} ₽</p>
                      {p.overdueDebt > 0 ? (
                        <p className="text-[11px] text-secondary">долг {formatRub(p.overdueDebt)}</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link
            href={ROUTES.adminCrm}
            className="interactive-press-sm block rounded-2xl border border-primary/20 bg-primary-light/60 px-4 py-3 text-center text-[13px] font-semibold text-primary"
          >
            Открыть CRM → кампании и сегменты
          </Link>
        </div>
      )}
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
