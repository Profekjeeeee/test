"use client";

import { useRouter } from "next/navigation";
import { logout } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";

const STATS = [
  { label: "Записей сегодня", value: "12", sub: "+3 с утра", color: "bg-[#D4ECED] dark:bg-[#1A3D3F]", textColor: "text-primary" },
  { label: "Активных врачей", value: "6", sub: "из 8 работают", color: "bg-amber-50 dark:bg-amber-900/20", textColor: "text-amber-600 dark:text-amber-400" },
  { label: "Пациентов", value: "148", sub: "за этот месяц", color: "bg-violet-50 dark:bg-violet-900/20", textColor: "text-violet-600 dark:text-violet-400" },
  { label: "Выручка, ₽", value: "284 500", sub: "за этот месяц", color: "bg-emerald-50 dark:bg-emerald-900/20", textColor: "text-emerald-600 dark:text-emerald-400" },
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
  done:     { label: "Выполнено", cls: "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400" },
  current:  { label: "Сейчас",   cls: "bg-[#D4ECED] dark:bg-[#1A3D3F] text-primary" },
  upcoming: { label: "Ожидает",  cls: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400" },
};

export default function AdminDashboardPage() {
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.replace(ROUTES.auth);
  };

  return (
    <main className="min-h-dvh bg-surface dark:bg-slate-950 pb-[84px]">
      {/* Header */}
      <div className="px-5 pt-12 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12px] font-medium text-secondary uppercase tracking-widest mb-1">Панель администратора</p>
            <h1 className="text-[24px] font-bold text-[#0F172A] dark:text-white">Дашборд</h1>
          </div>
          <button
            onClick={handleLogout}
            className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center active:scale-95 transition-transform"
            title="Выйти"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M9 21H5C4.44772 21 4 20.5523 4 20V4C4 3.44772 4.44772 3 5 3H9" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M16 17L21 12M21 12L16 7M21 12H9" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="px-5 grid grid-cols-2 gap-3 mb-6">
        {STATS.map((s) => (
          <div key={s.label} className={`rounded-2xl p-4 ${s.color}`}>
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
                key={i}
                className={`rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-start gap-3 ${
                  a.status === "current" ? "ring-1 ring-primary" : ""
                }`}
              >
                <div className="min-w-[44px] text-center">
                  <span className="text-[15px] font-bold text-[#0F172A] dark:text-white">{a.time}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[#0F172A] dark:text-white truncate">{a.patient}</p>
                  <p className="text-[12px] text-secondary truncate">{a.doctor} · {a.procedure}</p>
                </div>
                <span className={`text-[11px] font-medium px-2 py-1 rounded-lg shrink-0 ${cls}`}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
