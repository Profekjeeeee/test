"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import {
  fetchPlatformClinic,
  fetchSubscriptionPlans,
  updatePlatformClinic,
} from "@/lib/platform/client";
import { formatPlanPrice } from "@/lib/platform/plans";
import type { PlatformClinicRow, SubscriptionPlan } from "@/lib/platform/types";
import { ROUTES } from "@/lib/routes";

export default function PlatformClinicDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [clinic, setClinic] = useState<PlatformClinicRow | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [c, p] = await Promise.all([fetchPlatformClinic(id), fetchSubscriptionPlans()]);
      setClinic(c);
      setPlans(p);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePatch = async (patch: Record<string, unknown>) => {
    if (!id) return;
    setSaving(true);
    try {
      setClinic(await updatePlatformClinic(id, patch));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    }
    setSaving(false);
  };

  if (!clinic && !error) {
    return (
      <main className="min-h-dvh bg-surface p-5 dark:bg-app-canvas">
        <div className="h-32 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-surface pb-safe dark:bg-app-canvas">
      <div className="px-5 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-5">
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push(ROUTES.platformClinics)}
            className="interactive-press-sm flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
          >
            <ChevronLeft className="h-5 w-5 text-secondary" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-[20px] font-bold text-[#0F172A] dark:text-white">
              {clinic?.displayName ?? "Клиника"}
            </h1>
            <p className="text-[12px] text-secondary">{clinic?.slug}</p>
          </div>
        </div>

        {error ? <p className="mb-3 text-[13px] text-red-600">{error}</p> : null}

        {clinic ? (
          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="mb-3 text-[14px] font-semibold">Статистика</h2>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[18px] font-bold text-primary">{clinic.stats.patients}</p>
                  <p className="text-[11px] text-secondary">Пациентов</p>
                </div>
                <div>
                  <p className="text-[18px] font-bold text-primary">{clinic.stats.doctors}</p>
                  <p className="text-[11px] text-secondary">Врачей</p>
                </div>
                <div>
                  <p className="text-[18px] font-bold text-primary">{clinic.stats.appointmentsMonth}</p>
                  <p className="text-[11px] text-secondary">Записей/мес</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="mb-3 text-[14px] font-semibold">Подписка</h2>
              <label className="mb-2 block text-[12px] text-secondary">Тариф</label>
              <select
                className="mb-3 w-full rounded-xl border border-slate-200 bg-surface px-3 py-2.5 text-[14px] dark:border-slate-700"
                value={clinic.subscription?.planCode ?? "pro"}
                disabled={saving}
                onChange={(e) => void handlePatch({ planCode: e.target.value })}
              >
                {plans.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name} — {formatPlanPrice(p.priceMonthly)}
                  </option>
                ))}
              </select>

              <label className="mb-2 block text-[12px] text-secondary">Статус</label>
              <select
                className="mb-3 w-full rounded-xl border border-slate-200 bg-surface px-3 py-2.5 text-[14px] dark:border-slate-700"
                value={clinic.subscription?.status ?? "trial"}
                disabled={saving}
                onChange={(e) => void handlePatch({ subscriptionStatus: e.target.value })}
              >
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="past_due">Past due</option>
                <option value="suspended">Suspended</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <label className="flex items-center gap-2 text-[14px]">
                <input
                  type="checkbox"
                  checked={clinic.isActive}
                  disabled={saving}
                  onChange={(e) => void handlePatch({ isActive: e.target.checked })}
                  className="rounded border-slate-300 text-primary"
                />
                Клиника активна
              </label>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="mb-2 text-[14px] font-semibold">Деплой</h2>
              <p className="text-[13px] text-secondary">
                Отдельный Vercel preview с{" "}
                <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">CLINIC_SLUG={clinic.slug}</code>
              </p>
              <Link
                href={ROUTES.platformMonitoring}
                className="interactive-press-sm mt-3 inline-block text-[13px] font-semibold text-primary"
              >
                Мониторинг →
              </Link>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
