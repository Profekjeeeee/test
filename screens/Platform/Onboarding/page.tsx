"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPlatformClinic, fetchSubscriptionPlans } from "@/lib/platform/client";
import { formatPlanPrice } from "@/lib/platform/plans";
import type { SubscriptionPlan } from "@/lib/platform/types";
import { ROUTES } from "@/lib/routes";

export default function PlatformOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#248bcf");
  const [planCode, setPlanCode] = useState("starter");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminName, setAdminName] = useState("");

  useEffect(() => {
    void fetchSubscriptionPlans()
      .then(setPlans)
      .catch(() => {});
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const row = await createPlatformClinic({
        slug,
        name,
        displayName: displayName || name,
        planCode,
        adminPhone,
        adminName: adminName || "Администратор",
        city,
        phone,
        email,
        primaryColor,
      });
      router.push(`${ROUTES.platformClinics}/${row.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка создания");
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-dvh bg-surface pb-safe dark:bg-app-canvas">
      <div className="px-5 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-5">
        <h1 className="mb-1 text-[22px] font-bold text-[#0F172A] dark:text-white">Онбординг клиники</h1>
        <p className="mb-4 text-[13px] text-secondary">Шаг {step} из 3</p>

        <div className="mb-6 flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full ${s <= step ? "bg-primary" : "bg-slate-200 dark:bg-slate-700"}`}
            />
          ))}
        </div>

        {error ? <p className="mb-3 text-[13px] text-red-600">{error}</p> : null}

        {step === 1 ? (
          <div className="space-y-3">
            <Field label="Slug (URL)" value={slug} onChange={setSlug} placeholder="smile-moscow" hint="a-z, 0-9, дефис" />
            <Field label="Внутреннее имя" value={name} onChange={setName} placeholder="Smile Moscow" />
            <Field label="Отображаемое название" value={displayName} onChange={setDisplayName} placeholder="Стоматология Smile" />
            <button
              type="button"
              disabled={!slug.trim() || !name.trim()}
              onClick={() => setStep(2)}
              className="interactive-press w-full rounded-xl bg-primary py-3 text-[14px] font-semibold text-white disabled:opacity-50"
            >
              Далее
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <Field label="Город" value={city} onChange={setCity} />
            <Field label="Телефон клиники" value={phone} onChange={setPhone} placeholder="+7495..." />
            <Field label="Email" value={email} onChange={setEmail} />
            <div>
              <label className="mb-1 block text-[12px] text-secondary">Цвет бренда</label>
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200"
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(1)} className="interactive-press flex-1 rounded-xl border py-3 text-[14px]">
                Назад
              </button>
              <button type="button" onClick={() => setStep(3)} className="interactive-press flex-1 rounded-xl bg-primary py-3 text-[14px] font-semibold text-white">
                Далее
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <div>
              <label className="mb-2 block text-[12px] text-secondary">Тариф (14 дней trial)</label>
              <div className="space-y-2">
                {plans.map((p) => (
                  <label
                    key={p.code}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
                      planCode === p.code ? "border-primary bg-primary/5" : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="plan"
                      checked={planCode === p.code}
                      onChange={() => setPlanCode(p.code)}
                      className="mt-1 text-primary"
                    />
                    <div>
                      <p className="text-[14px] font-semibold text-[#0F172A] dark:text-white">{p.name}</p>
                      <p className="text-[12px] text-secondary">{p.description}</p>
                      <p className="mt-1 text-[13px] font-medium text-primary">{formatPlanPrice(p.priceMonthly)}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <Field label="Телефон администратора" value={adminPhone} onChange={setAdminPhone} placeholder="+79..." />
            <Field label="Имя администратора" value={adminName} onChange={setAdminName} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(2)} className="interactive-press flex-1 rounded-xl border py-3 text-[14px]">
                Назад
              </button>
              <button
                type="button"
                disabled={submitting || !adminPhone.trim()}
                onClick={() => void handleSubmit()}
                className="interactive-press flex-1 rounded-xl bg-primary py-3 text-[14px] font-semibold text-white disabled:opacity-50"
              >
                {submitting ? "Создание…" : "Создать клинику"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[12px] text-secondary">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] dark:border-slate-700 dark:bg-slate-900"
      />
      {hint ? <p className="mt-1 text-[11px] text-secondary">{hint}</p> : null}
    </div>
  );
}
