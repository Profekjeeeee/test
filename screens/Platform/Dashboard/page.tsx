"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, CreditCard, TrendingUp } from "lucide-react";
import ThemeToggleButton from "@/components/ui/ThemeToggleButton";
import { logout } from "@/lib/auth";
import { fetchPlatformStats } from "@/lib/platform/client";
import type { PlatformStats } from "@/lib/platform/types";
import { ROUTES } from "@/lib/routes";

function formatRub(n: number): string {
  return n.toLocaleString("ru-RU");
}

export default function PlatformDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await fetchPlatformStats());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cards = stats
    ? [
        { label: "Клиник", value: String(stats.totalClinics), sub: `${stats.activeClinics} активных`, icon: Building2 },
        { label: "MRR", value: `${formatRub(stats.mrrRub)} ₽`, sub: `${stats.trialClinics} на trial`, icon: CreditCard },
        { label: "Записей 24ч", value: String(stats.appointments24h), sub: `${stats.errors24h} ошибок`, icon: TrendingUp },
      ]
    : [];

  return (
    <main className="min-h-dvh bg-surface pb-safe dark:bg-app-canvas">
      <div className="px-5 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="mb-1 text-[12px] font-medium uppercase tracking-widest text-secondary">Super Admin</p>
            <h1 className="text-[24px] font-bold text-[#0F172A] dark:text-white">Платформа</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggleButton sizeClass="h-9 w-9" />
            <button
              type="button"
              onClick={() => {
                logout();
                router.replace(ROUTES.auth);
              }}
              className="interactive-press-sm flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-gray-100 dark:border-slate-700 dark:bg-slate-800"
              title="Выйти"
            >
              ↪
            </button>
          </div>
        </div>

        {error ? <p className="mt-3 text-[13px] text-red-600">{error}</p> : null}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {loading
            ? [1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
              ))
            : cards.map((c) => (
                <div
                  key={c.label}
                  className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="mb-2 flex items-center gap-2 text-secondary">
                    <c.icon className="h-4 w-4" />
                    <span className="text-[12px] font-medium uppercase tracking-wide">{c.label}</span>
                  </div>
                  <p className="text-[22px] font-bold text-[#0F172A] dark:text-white">{c.value}</p>
                  <p className="mt-1 text-[12px] text-secondary">{c.sub}</p>
                </div>
              ))}
        </div>

        {stats?.planBreakdown.length ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-3 text-[14px] font-semibold text-[#0F172A] dark:text-white">Тарифы</h2>
            <div className="space-y-2">
              {stats.planBreakdown.map((p) => (
                <div key={p.code} className="flex items-center justify-between text-[13px]">
                  <span className="text-[#0F172A] dark:text-white">{p.name}</span>
                  <span className="rounded-lg bg-primary/10 px-2 py-0.5 font-medium text-primary">{p.count}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3">
          <Link
            href={ROUTES.platformClinics}
            className="interactive-press-sm rounded-2xl border border-primary/20 bg-primary-light/60 px-4 py-3 dark:bg-primary/10"
          >
            <span className="text-[14px] font-semibold text-primary">Управление клиниками →</span>
          </Link>
          <Link
            href={ROUTES.platformOnboarding}
            className="interactive-press-sm rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
          >
            <span className="text-[14px] font-semibold text-[#0F172A] dark:text-white">Подключить новую клинику →</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
