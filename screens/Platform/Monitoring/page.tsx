"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchPlatformMonitoring } from "@/lib/platform/client";
import type { PlatformMonitoringRow } from "@/lib/platform/types";
import { ROUTES } from "@/lib/routes";

export default function PlatformMonitoringPage() {
  const [rows, setRows] = useState<PlatformMonitoringRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchPlatformMonitoring());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="min-h-dvh bg-surface pb-safe dark:bg-app-canvas">
      <div className="px-5 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-5">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-[22px] font-bold text-[#0F172A] dark:text-white">Мониторинг</h1>
          <button
            type="button"
            onClick={() => void load()}
            className="interactive-press-sm rounded-xl border border-slate-200 px-3 py-2 text-[13px] text-primary dark:border-slate-700"
          >
            Обновить
          </button>
        </div>

        <p className="mb-4 text-[13px] text-secondary">Ошибки и предупреждения app_logs за 24 часа по клиникам.</p>

        {error ? <p className="mb-3 text-[13px] text-red-600">{error}</p> : null}

        {loading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-secondary dark:border-slate-800">
                  <th className="px-3 py-2">Клиника</th>
                  <th className="px-3 py-2">План</th>
                  <th className="px-3 py-2 text-center">ERR</th>
                  <th className="px-3 py-2 text-center">WARN</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.clinicId} className="border-b border-slate-50 dark:border-slate-800">
                    <td className="px-3 py-2.5">
                      <Link href={`${ROUTES.platformClinics}/${r.clinicId}`} className="font-medium text-primary">
                        {r.displayName}
                      </Link>
                      <p className="text-[11px] text-secondary">{r.slug}</p>
                    </td>
                    <td className="px-3 py-2.5 text-secondary">{r.planCode}</td>
                    <td className={`px-3 py-2.5 text-center font-semibold ${r.errors24h > 0 ? "text-red-600" : "text-secondary"}`}>
                      {r.errors24h}
                    </td>
                    <td className={`px-3 py-2.5 text-center ${r.warnings24h > 0 ? "text-amber-600" : "text-secondary"}`}>
                      {r.warnings24h}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
