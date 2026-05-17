"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import {
  clearDentalLogs,
  DENTAL_LOGS_KEY,
  getDentalLogsNewestFirst,
  type DentalLog,
} from "@/lib/logger";

const STATS = [
  { label: "Записей сегодня", value: "12", sub: "+3 с утра", color: "bg-primary-light", textColor: "text-primary" },
  { label: "Активных врачей", value: "6", sub: "из 8 работают", color: "bg-amber-50 dark:bg-amber-900/20", textColor: "text-amber-600 dark:text-amber-400" },
  { label: "Пациентов", value: "148", sub: "за этот месяц", color: "bg-violet-50 dark:bg-violet-900/20", textColor: "text-violet-600 dark:text-violet-400" },
  { label: "Выручка, ₽", value: "284 500", sub: "за этот месяц", color: "bg-primary-light", textColor: "text-primary" },
];

const TODAY_APPOINTMENTS = [
  { time: "09:00", patient: "Иванова А.С.", doctor: "Смирнов К.А.", procedure: "Осмотр", status: "done" },
  { time: "10:30", patient: "Петров Д.М.", doctor: "Козлова Е.В.", procedure: "Лечение кариеса", status: "done" },
  { time: "12:00", patient: "Сидорова Л.П.", doctor: "Смирнов К.А.", procedure: "Удаление зуба", status: "current" },
  { time: "13:30", patient: "Нурмагамбетов Р.А.", doctor: "Федоров И.С.", procedure: "Брекеты — контроль", status: "upcoming" },
  { time: "15:00", patient: "Морозова К.Г.", doctor: "Козлова Е.В.", procedure: "Чистка", status: "upcoming" },
  { time: "16:30", patient: "Александров В.Д.", doctor: "Смирнов К.А.", procedure: "Имплант — этап 2", status: "upcoming" },
];

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  done: { label: "Выполнено", cls: "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400" },
  current: { label: "Сейчас", cls: "bg-primary-light text-primary" },
  upcoming: { label: "Ожидает", cls: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400" },
};

function logLevelBadgeClasses(level: DentalLog["level"]): string {
  if (level === "ERROR") return "text-red-600 dark:text-red-400 font-semibold";
  if (level === "WARN") return "text-amber-600 dark:text-amber-400 font-semibold";
  return "text-secondary font-medium dark:text-blue-300/90 dark:font-semibold text-[#475569]";
}

function formatLogTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return String(ts);
  }
}

type DashboardTabId = "main" | "logs";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [section, setSection] = useState<DashboardTabId>("main");
  const [logs, setLogs] = useState<DentalLog[]>(() => getDentalLogsNewestFirst());

  const reloadLogs = useCallback(() => {
    setLogs(getDentalLogsNewestFirst());
  }, []);

  useEffect(() => {
    if (section !== "logs") return;
    reloadLogs();
    const onStorage = (e: StorageEvent) => {
      if (e.key !== DENTAL_LOGS_KEY && e.key !== null) return;
      reloadLogs();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [section, reloadLogs]);

  useEffect(() => {
    const onCustom = () => reloadLogs();
    window.addEventListener("dental_logs_updated", onCustom);
    return () => window.removeEventListener("dental_logs_updated", onCustom);
  }, [reloadLogs]);

  const handleLogout = () => {
    logout();
    router.replace(ROUTES.auth);
  };

  const handleClearLogs = () => {
    clearDentalLogs();
    reloadLogs();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("dental_logs_updated"));
    }
  };

  return (
    <main className="min-h-dvh bg-surface dark:bg-app-canvas pb-[84px]">
      <div className="px-5 pt-12 pb-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-medium text-secondary uppercase tracking-widest mb-1">Панель администратора</p>
            <h1 className="text-[24px] font-bold text-[#0F172A] dark:text-white">Дашборд</h1>
          </div>
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

        <div className="flex rounded-[14px] bg-gray-100 dark:bg-slate-800 p-1 gap-1 mt-5">
          {(
            [
              { id: "main" as const, label: "Обзор" },
              { id: "logs" as const, label: "Логи системы" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSection(t.id)}
              className={`interactive-press-sm flex-1 py-2.5 rounded-[11px] text-[13px] font-semibold transition-all border ${
                section === t.id
                  ? "bg-white dark:bg-slate-900 text-primary shadow-[0_4px_14px_rgba(15,23,42,0.08)] border-slate-200 dark:border-slate-700"
                  : "border-slate-200/85 dark:border-slate-600 text-slate-700 dark:text-slate-400 bg-transparent"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {section === "logs" ? (
        <div className="px-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] text-secondary">
              События из localStorage (лимит 200 записей). Свежие — сверху.
            </p>
            <button
              type="button"
              onClick={handleClearLogs}
              className="interactive-press-sm shrink-0 px-4 py-2 rounded-[12px] border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-900 text-[12px] font-semibold text-red-600 dark:text-red-400 shadow-raised-surface"
            >
              Очистить логи
            </button>
          </div>

          <div className="rounded-[16px] border border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-900/80 overflow-hidden shadow-[0_4px_16px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
            <div className="max-h-[calc(100dvh-260px)] overflow-auto font-mono text-[11px] leading-snug">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white/95 dark:bg-slate-900/95 border-b border-[#E2E8F0] dark:border-slate-700 z-10">
                  <tr className="text-secondary uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3 font-semibold">Время</th>
                    <th className="py-2.5 px-2 font-semibold">Ур.</th>
                    <th className="py-2.5 px-2 font-semibold">Роль</th>
                    <th className="py-2.5 px-2 font-semibold">Действие</th>
                    <th className="py-2.5 px-3 font-semibold">Детали</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-secondary">
                        Логи пусты
                      </td>
                    </tr>
                  ) : (
                    logs.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-[#E2E8F0]/80 dark:border-slate-800 odd:bg-white/60 dark:odd:bg-app-canvas/40"
                      >
                        <td className="py-2 px-3 whitespace-nowrap text-secondary tabular-nums">{formatLogTime(row.timestamp)}</td>
                        <td className={`py-2 px-2 whitespace-nowrap ${logLevelBadgeClasses(row.level)}`}>{row.level}</td>
                        <td className="py-2 px-2 whitespace-nowrap text-[#0F172A] dark:text-slate-200">{row.role}</td>
                        <td className="py-2 px-2 font-semibold text-[#0F172A] dark:text-white break-all">{row.action}</td>
                        <td className="py-2 px-3 text-secondary break-all max-w-[140px] sm:max-w-[220px]">{row.details ?? "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="px-5 grid grid-cols-2 gap-3 mb-6">
            {STATS.map((s) => (
              <div key={s.label} className={`rounded-2xl p-4 shadow-[0_4px_14px_rgba(15,23,42,0.07)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.35)] border border-slate-200/80 dark:border-slate-700/50 ${s.color}`}>
                <p className={`text-[26px] font-bold ${s.textColor} leading-none`}>{s.value}</p>
                <p className="text-[12px] font-semibold text-[#0F172A] dark:text-white mt-1 leading-tight">{s.label}</p>
                <p className="text-[11px] text-secondary mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Today schedule */}
          <div className="px-5">
            <h2 className="text-[16px] font-bold text-[#0F172A] dark:text-white mb-3">Расписание на сегодня</h2>
            <div className="flex flex-col gap-2">
              {TODAY_APPOINTMENTS.map((a, i) => {
                const { label, cls } = STATUS_MAP[a.status];
                return (
                  <div
                    key={`${a.time}_${i}`}
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
              })}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
