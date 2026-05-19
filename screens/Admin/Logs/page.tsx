"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import LogsTable from "@/components/admin/LogsTable";
import ThemeToggleButton from "@/components/ui/ThemeToggleButton";
import { useDownloadLogs } from "@/hooks/useDownloadLogs";
import { logout } from "@/lib/auth";
import {
  APP_LOGS_UPDATED_EVENT,
  clearAppLogs,
  fetchAppLogs,
  type DentalLog,
} from "@/lib/logger";
import { ROUTES } from "@/lib/routes";

export default function AdminLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<DentalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { download, canDownload } = useDownloadLogs(logs, "json");

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchError } = await fetchAppLogs();
    setLoading(false);
    if (fetchError) {
      setError(fetchError);
      setLogs([]);
      return;
    }
    setError("");
    setLogs(data);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onUpdated = () => void reload();
    window.addEventListener(APP_LOGS_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(APP_LOGS_UPDATED_EVENT, onUpdated);
  }, [reload]);

  const handleClear = () => {
    void (async () => {
      const { error: clearError } = await clearAppLogs();
      if (clearError) {
        setError(clearError);
        return;
      }
      setError("");
      await reload();
    })();
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
              <h1 className="text-[22px] font-bold text-[#0F172A] dark:text-white">Логи системы</h1>
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

        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-[13px] text-secondary">События из Supabase. Свежие — сверху.</p>
          <button
            type="button"
            onClick={handleClear}
            className="interactive-press-sm shrink-0 rounded-[12px] border border-red-200 bg-white px-4 py-2 text-[12px] font-semibold text-red-600 shadow-raised-surface dark:border-red-900/60 dark:bg-slate-900 dark:text-red-400"
          >
            Очистить
          </button>
        </div>
      </div>

      <div className="px-5">
        {error ? <p className="mb-2 text-[13px] text-red-600 dark:text-red-400">{error}</p> : null}
        {loading ? (
          <p className="py-8 text-center text-[13px] text-secondary">Загрузка логов…</p>
        ) : (
          <LogsTable logs={logs} onDownload={download} canDownload={canDownload} />
        )}
      </div>
    </main>
  );
}
