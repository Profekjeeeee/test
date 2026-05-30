"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import ThemeToggleButton from "@/components/ui/ThemeToggleButton";
import { useClinic } from "@/contexts/ClinicProvider";
import { patchClinicSettings } from "@/lib/admin/settings";
import { logout } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";

export default function AdminSettingsPage() {
  const router = useRouter();
  const { settings, refresh } = useClinic();
  const [displayName, setDisplayName] = useState("");
  const [tagline, setTagline] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#248bcf");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setDisplayName(settings.displayName);
    setTagline(settings.tagline);
    setPhone(settings.phone);
    setEmail(settings.email);
    setCity(settings.city);
    setAddressLine1(settings.addressLine1);
    setPrimaryColor(settings.primaryColor);
  }, [settings]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      await patchClinicSettings({
        displayName,
        tagline,
        phone,
        email,
        city,
        addressLine1,
        primaryColor,
      });
      await refresh();
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    }
    setSaving(false);
  }, [displayName, tagline, phone, email, city, addressLine1, primaryColor, refresh]);

  return (
    <main className="min-h-dvh bg-surface pb-24 dark:bg-app-canvas">
      <div className="px-5 pt-[calc(env(safe-area-inset-top,0px)+3rem)] pb-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href={ROUTES.adminDashboard}
              className="interactive-press-sm flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
            >
              <ChevronLeft className="h-5 w-5 text-secondary" />
            </Link>
            <div>
              <p className="text-[12px] font-medium uppercase tracking-widest text-secondary">Админ</p>
              <h1 className="text-[22px] font-bold text-[#0F172A] dark:text-white">Настройки клиники</h1>
            </div>
          </div>
          <ThemeToggleButton sizeClass="h-9 w-9" />
        </div>

        <div className="space-y-3">
          <Field label="Название" value={displayName} onChange={setDisplayName} />
          <Field label="Слоган" value={tagline} onChange={setTagline} />
          <Field label="Адрес" value={addressLine1} onChange={setAddressLine1} />
          <Field label="Город" value={city} onChange={setCity} />
          <Field label="Телефон" value={phone} onChange={setPhone} />
          <Field label="Email" value={email} onChange={setEmail} />
          <div>
            <label className="mb-1 block text-[12px] text-secondary">Основной цвет</label>
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200"
            />
          </div>
        </div>

        {error ? <p className="mt-3 text-[13px] text-red-600">{error}</p> : null}
        {success ? <p className="mt-3 text-[13px] text-primary">Сохранено</p> : null}

        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="interactive-press mt-4 w-full rounded-xl bg-primary py-3 text-[14px] font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Сохранение…" : "Сохранить"}
        </button>

        <button
          type="button"
          onClick={() => {
            logout();
            router.replace(ROUTES.auth);
          }}
          className="interactive-press-sm mt-3 w-full rounded-xl border border-slate-200 py-2.5 text-[13px] text-secondary"
        >
          Выйти
        </button>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[12px] text-secondary">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] dark:border-slate-700 dark:bg-slate-900"
      />
    </div>
  );
}
