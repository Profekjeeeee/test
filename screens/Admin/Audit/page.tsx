"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Download, ShieldCheck } from "lucide-react";
import AuditLogsTable from "@/components/admin/AuditLogsTable";
import ThemeToggleButton from "@/components/ui/ThemeToggleButton";
import {
  AUDIT_TABLE_FILTER_OPTIONS,
  exportAuditLogsCsv,
  fetchAuditLogs,
  type AuditAction,
  type AuditLogEntry,
} from "@/lib/auditLogs";
import { logout } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { tgHapticSuccess } from "@/lib/telegramHaptic";

const ACTION_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Все действия" },
  { value: "insert", label: "Создание" },
  { value: "update", label: "Изменение" },
  { value: "delete", label: "Удаление" },
];

export default function AdminAuditPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tableFilter, setTableFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [patientFilter, setPatientFilter] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchError } = await fetchAuditLogs({
      tableName: tableFilter || undefined,
      action: (actionFilter as AuditAction) || undefined,
      patientId: patientFilter.trim() || undefined,
    });
    setLoading(false);
    if (fetchError) {
      setError(fetchError);
      setEntries([]);
      return;
    }
    setError("");
    setEntries(data);
  }, [tableFilter, actionFilter, patientFilter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleExport = () => {
    if (!entries.length) return;
    const csv = exportAuditLogsCsv(entries);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    tgHapticSuccess();
  };

  const handleLogout = () => {
    logout();
    router.replace(ROUTES.auth);
  };

  return (
    <main className="min-h-dvh bg-surface dark:bg-app-canvas pb-safe">
      <div className="px-5 pt-[calc(env(safe-area-inset-top,0px)+3rem)] pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <Link
              href={ROUTES.adminDashboard}
              className="interactive-press-sm mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
              aria-label="Назад к дашборду"
            >
              <ChevronLeft className="h-5 w-5 text-secondary" />
            </Link>
            <div className="min-w-0">
              <p className="mb-1 text-[12px] font-medium uppercase tracking-widest text-secondary">
                Панель администратора
              </p>
              <h1 className="text-[22px] font-bold text-[#0F172A] dark:text-white">
                Audit Trail
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggleButton sizeClass="w-9 h-9" />
            <button
              type="button"
              onClick={handleLogout}
              className="interactive-press-sm flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-gray-100 dark:border-slate-700 dark:bg-slate-800 shadow-raised-surface"
              title="Выйти"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M9 21H5C4.44772 21 4 20.5523 4 20V4C4 3.44772 4.44772 3 5 3H9"
                  stroke="#9CA3AF"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M16 17L21 12M21 12L16 7M21 12H9"
                  stroke="#9CA3AF"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary-light/50 px-4 py-3 dark:border-primary/30 dark:bg-primary/10">
          <ShieldCheck className="h-5 w-5 shrink-0 text-primary mt-0.5" aria-hidden />
          <p className="text-[12px] leading-relaxed text-navy dark:text-slate-200">
            Неизменяемый журнал изменений мед. данных: записи, визиты, файлы, план лечения,
            формула зубов. Запись через триггеры Supabase.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-navy dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            {AUDIT_TABLE_FILTER_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-navy dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            {ACTION_FILTER_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={patientFilter}
            onChange={(e) => setPatientFilter(e.target.value)}
            placeholder="ID пациента…"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-navy placeholder:text-secondary dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-[13px] text-secondary">
            {loading ? "Загрузка…" : `${entries.length} записей`}
          </p>
          <button
            type="button"
            onClick={handleExport}
            disabled={!entries.length}
            className="interactive-press-sm inline-flex items-center gap-1.5 rounded-[12px] border border-primary/25 bg-white px-3 py-2 text-[12px] font-semibold text-primary disabled:opacity-40 dark:bg-slate-900"
          >
            <Download className="h-4 w-4" aria-hidden />
            CSV
          </button>
        </div>
      </div>

      <div className="px-5">
        {error ? <p className="mb-2 text-[13px] text-red-600 dark:text-red-400">{error}</p> : null}
        {loading ? (
          <p className="py-8 text-center text-[13px] text-secondary">Загрузка журнала…</p>
        ) : (
          <AuditLogsTable entries={entries} />
        )}
      </div>
    </main>
  );
}
