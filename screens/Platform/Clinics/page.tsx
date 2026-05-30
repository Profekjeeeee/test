"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { fetchPlatformClinics } from "@/lib/platform/client";
import { formatPlanPrice } from "@/lib/platform/plans";
import type { PlatformClinicRow } from "@/lib/platform/types";
import { ROUTES } from "@/lib/routes";

const STATUS_LABELS: Record<string, string> = {
  trial: "Trial",
  active: "Активна",
  past_due: "Просрочка",
  cancelled: "Отменена",
  suspended: "Приостановлена",
};

export default function PlatformClinicsPage() {
  const [clinics, setClinics] = useState<PlatformClinicRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setClinics(await fetchPlatformClinics());
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
          <h1 className="text-[22px] font-bold text-[#0F172A] dark:text-white">Клиники</h1>
          <Link
            href={ROUTES.platformOnboarding}
            className="interactive-press-sm rounded-xl bg-primary px-3 py-2 text-[13px] font-semibold text-white"
          >
            + Новая
          </Link>
        </div>

        {error ? <p className="mb-3 text-[13px] text-red-600">{error}</p> : null}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {clinics.map((c) => (
              <Link
                key={c.id}
                href={`${ROUTES.platformClinics}/${c.id}`}
                className="interactive-press-sm flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[15px] font-semibold text-[#0F172A] dark:text-white">
                      {c.displayName}
                    </p>
                    {!c.isActive ? (
                      <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-secondary dark:bg-slate-800">
                        off
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[12px] text-secondary">
                    {c.slug} · {c.stats.patients} пац. · {c.stats.doctors} врач.
                  </p>
                  {c.subscription ? (
                    <p className="mt-1 text-[12px] text-primary">
                      {c.subscription.planName} · {STATUS_LABELS[c.subscription.status] ?? c.subscription.status}
                      {" · "}
                      {formatPlanPrice(c.subscription.priceMonthly)}
                    </p>
                  ) : null}
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-secondary" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
